import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const receiptNumber = url.searchParams.get("receipt_number");
    const schoolCode = url.searchParams.get("school_code");

    if (!receiptNumber || typeof receiptNumber !== "string" || receiptNumber.length > 50) {
      return new Response(
        JSON.stringify({ error: "Valid receipt_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate receipt number format (alphanumeric with hyphens/slashes)
    if (!/^[A-Za-z0-9\-\/]+$/.test(receiptNumber)) {
      return new Response(
        JSON.stringify({ error: "Invalid receipt number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit: 10 receipt verifications per IP per 5 minutes
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("cf-connecting-ip") || "unknown";

    const { data: rateLimit } = await supabase.rpc("check_rate_limit", {
      _ip: clientIp,
      _type: "receipt_verify",
      _max_attempts: 10,
      _window_minutes: 5,
    });

    if (rateLimit && !rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many verification attempts. Please try again later.",
          retry_after_seconds: rateLimit.retry_after_seconds,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up payment by receipt number
    const { data: payment, error: paymentError } = await supabase
      .from("fee_payments")
      .select("id, receipt_number, amount, payment_date, payment_method, student_id, invoice_id, school_id")
      .eq("receipt_number", receiptNumber)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ verified: false, error: "Receipt not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If school_code is provided, verify it matches the payment's school
    if (schoolCode) {
      const { data: school } = await supabase
        .from("schools")
        .select("code")
        .eq("id", payment.school_id)
        .single();

      if (!school || school.code.toLowerCase() !== schoolCode.toLowerCase()) {
        return new Response(
          JSON.stringify({ verified: false, error: "Receipt not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get school name only
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", payment.school_id)
      .single();

    // Return minimal verified response — no student PII
    return new Response(
      JSON.stringify({
        verified: true,
        receipt_number: payment.receipt_number,
        amount_paid: payment.amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        school_name: school?.name || "N/A",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
