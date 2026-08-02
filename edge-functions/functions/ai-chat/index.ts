import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const FLASH_MODEL = 'google/gemini-3.6-flash';
const PRO_MODEL = 'google/gemini-3.1-pro-preview';

const REASONING_KEYWORDS = /\b(analy[sz]e|compare|explain why|reason|deep|strategy|forecast|plan|breakdown|optimi[sz]e|recommend|pros and cons)\b/i;

interface AiSchoolConfig {
  enabled: boolean;
  model: 'auto' | 'flash' | 'pro';
  tone: 'friendly' | 'formal' | 'concise' | 'playful';
  custom_instructions: string;
  allowed_roles: string[];
}

const AI_DEFAULTS: AiSchoolConfig = {
  enabled: true,
  model: 'auto',
  tone: 'friendly',
  custom_instructions: '',
  allowed_roles: ['parent', 'student', 'teacher', 'school_admin', 'super_admin'],
};

function pickModel(userMessage: string, override: AiSchoolConfig['model']): string {
  if (override === 'flash') return FLASH_MODEL;
  if (override === 'pro') return PRO_MODEL;
  if (userMessage.length > 500) return PRO_MODEL;
  if (REASONING_KEYWORDS.test(userMessage)) return PRO_MODEL;
  return FLASH_MODEL;
}

// Role-tailored context. Keeps queries tight and cheap.
async function buildRoleContext(admin: ReturnType<typeof createClient>, userId: string, role: string, schoolId: string | null): Promise<string> {
  const facts: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  facts.push(`Today's date: ${today}.`);

  try {
    if (schoolId) {
      const { data: school } = await admin.from('schools').select('name, city, code').eq('id', schoolId).maybeSingle();
      if (school) facts.push(`School: ${school.name} (${school.city}), code ${school.code}.`);
    }

    if (role === 'parent') {
      const { data: children } = await admin
        .from('students')
        .select('id, full_name, admission_number, class_name, section')
        .eq('parent_user_id', userId)
        .limit(10);
      if (children?.length) {
        facts.push(`Children linked to this parent: ${children.map((c: any) => `${c.full_name} (${c.class_name || 'N/A'}${c.section ? '-' + c.section : ''}, admission ${c.admission_number})`).join('; ')}.`);

        const ids = children.map((c: any) => c.id);
        const { data: invoices } = await admin
          .from('fee_invoices')
          .select('student_id, balance, status, due_date')
          .in('student_id', ids)
          .neq('status', 'PAID')
          .order('due_date', { ascending: true })
          .limit(20);
        if (invoices?.length) {
          const totalDue = invoices.reduce((s: number, i: any) => s + Number(i.balance || 0), 0);
          facts.push(`Total outstanding fee balance across children: ₹${totalDue.toFixed(2)} across ${invoices.length} invoices.`);
        } else {
          facts.push('No outstanding fee invoices for these children.');
        }

        const monthStart = new Date();
        monthStart.setDate(1);
        const { data: att } = await admin
          .from('attendance')
          .select('status, student_id')
          .in('student_id', ids)
          .gte('date', monthStart.toISOString().slice(0, 10));
        if (att?.length) {
          const present = att.filter((a: any) => a.status === 'PRESENT').length;
          const absent = att.filter((a: any) => a.status === 'ABSENT').length;
          facts.push(`This month's attendance: ${present} present days, ${absent} absent days.`);
        }
      }
    } else if (role === 'student') {
      const { data: student } = await admin
        .from('students')
        .select('id, full_name, class_name, section, admission_number')
        .eq('user_id', userId)
        .maybeSingle();
      if (student) {
        facts.push(`Student: ${student.full_name}, class ${student.class_name || 'N/A'}${student.section ? '-' + student.section : ''}.`);
        const { data: hw } = await admin
          .from('homework')
          .select('title, due_date, subject')
          .eq('school_id', schoolId)
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(5);
        if (hw?.length) facts.push(`Upcoming homework: ${hw.map((h: any) => `${h.subject}: ${h.title} (due ${h.due_date})`).join('; ')}.`);
      }
    } else if (role === 'teacher') {
      const { data: teacher } = await admin
        .from('teachers')
        .select('full_name, employee_id, subjects, classes')
        .eq('user_id', userId)
        .maybeSingle();
      if (teacher) {
        facts.push(`Teacher: ${teacher.full_name} (ID ${teacher.employee_id}). Subjects: ${(teacher.subjects || []).join(', ') || 'N/A'}. Classes: ${(teacher.classes || []).join(', ') || 'N/A'}.`);
      }
    } else if (role === 'school_admin' && schoolId) {
      const { count: studentCount } = await admin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
      const { count: teacherCount } = await admin.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
      const { data: absentToday } = await admin.from('attendance').select('id').eq('school_id', schoolId).eq('date', today).eq('status', 'ABSENT');
      facts.push(`School stats: ${studentCount || 0} active students, ${teacherCount || 0} active teachers. Absent today: ${absentToday?.length || 0}.`);

      const { data: pendingFees } = await admin
        .from('fee_invoices')
        .select('balance')
        .eq('school_id', schoolId)
        .neq('status', 'PAID')
        .limit(1000);
      if (pendingFees) {
        const total = pendingFees.reduce((s: number, i: any) => s + Number(i.balance || 0), 0);
        facts.push(`Total outstanding fees across school: ₹${total.toFixed(2)}.`);
      }
    } else if (role === 'super_admin') {
      const { count: schoolCount } = await admin.from('schools').select('id', { count: 'exact', head: true });
      const { count: activeSchools } = await admin.from('schools').select('id', { count: 'exact', head: true }).eq('is_active', true);
      facts.push(`Platform stats: ${schoolCount || 0} total schools, ${activeSchools || 0} active.`);
    }

    // Recent school-wide announcements for any role
    if (schoolId) {
      const { data: anns } = await admin
        .from('announcements')
        .select('title, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(3);
      if (anns?.length) facts.push(`Recent announcements: ${anns.map((a: any) => a.title).join('; ')}.`);
    }
  } catch (e) {
    console.error('context build error', e);
  }

  return facts.join('\n');
}

function buildSystemPrompt(role: string, roleContext: string, userName: string, schoolName: string, cfg: AiSchoolConfig): string {
  const toneLine: Record<AiSchoolConfig['tone'], string> = {
    friendly: 'Warm, encouraging, use light emoji.',
    formal: 'Professional, respectful, no emoji, no slang.',
    concise: 'Extremely brief. Prefer bullet points. Skip pleasantries.',
    playful: 'Fun, upbeat, feel free to use emoji and light humour.',
  };
  const custom = cfg.custom_instructions?.trim()
    ? `\nSchool-specific instructions (MUST follow):\n${cfg.custom_instructions.trim()}\n`
    : '';
  return `You are OurSchool AI, an assistant embedded inside the Our School Tech school management platform.

You are talking to ${userName || 'a user'} (role: ${role}) at ${schoolName || 'their school'}.

Response tone: ${toneLine[cfg.tone] ?? toneLine.friendly}
${custom}
Guidelines:
- Answer clearly in the user's language when they use one (English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali).
- Use markdown for lists, bold key numbers, and add small emoji where appropriate.
- Keep answers short and helpful. Don't over-explain.
- You have live context from this user's school (below). Use it to answer school-specific questions accurately. Do not invent data beyond what's provided; if unsure, say so and suggest where in the app to look.
- Never reveal data about other schools, other parents' children, or other students.
- For non-school questions (general knowledge, homework help, study tips, life questions) answer helpfully as a general assistant.
- Refuse: medical/legal/financial advice, anything harmful, requests for other users' private data.

Live school context:
${roleContext}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { conversationId: incomingConvId, message } = body ?? {};
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return new Response(JSON.stringify({ error: 'Invalid message' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limit: max 30 user messages / hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from('ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', hourAgo);
    if ((recentCount || 0) >= 30) {
      return new Response(JSON.stringify({ error: "You've hit the hourly message limit. Try again in a bit." }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch role + school
    const { data: authData } = await admin.rpc('get_user_auth_data', { _user_id: user.id });
    const profile: any = (authData as any)?.profile;
    const role: string = (authData as any)?.role || 'student';
    const school: any = (authData as any)?.school;
    const schoolId: string | null = profile?.school_id || null;

    // Load per-school AI settings (fall back to global defaults, then hard defaults)
    let aiCfg: AiSchoolConfig = { ...AI_DEFAULTS };
    const { data: defaultsRow } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_defaults')
      .maybeSingle();
    if (defaultsRow?.value) aiCfg = { ...aiCfg, ...(defaultsRow.value as Partial<AiSchoolConfig>) };
    if (schoolId) {
      const { data: schoolRow } = await admin
        .from('schools')
        .select('ai_settings')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolRow?.ai_settings) aiCfg = { ...aiCfg, ...(schoolRow.ai_settings as Partial<AiSchoolConfig>) };
    }
    if (!aiCfg.enabled) {
      return new Response(JSON.stringify({ error: 'OurSchool AI is disabled for your school.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!aiCfg.allowed_roles.includes(role)) {
      return new Response(JSON.stringify({ error: 'OurSchool AI is not enabled for your role.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get or create conversation
    let conversationId: string = incomingConvId;
    if (!conversationId) {
      const title = message.trim().slice(0, 60);
      const { data: newConv, error: convErr } = await admin
        .from('ai_conversations')
        .insert({ user_id: user.id, school_id: schoolId, title })
        .select('id')
        .single();
      if (convErr || !newConv) {
        return new Response(JSON.stringify({ error: 'Could not start conversation' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      conversationId = newConv.id;
    } else {
      // Verify ownership
      const { data: owned } = await admin.from('ai_conversations').select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
      if (!owned) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Persist user message
    await admin.from('ai_messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: message,
    });

    // Load history (last 20)
    const { data: history } = await admin
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40);

    const historyMessages = (history || []).slice(-20).map((m: any) => ({ role: m.role, content: m.content }));

    // Build system prompt with live role context
    const roleContext = await buildRoleContext(admin, user.id, role, schoolId);
    const systemPrompt = buildSystemPrompt(role, roleContext, profile?.full_name || '', school?.name || '', aiCfg);

    const model = pickModel(message, aiCfg.model);

    const upstream = await fetch(LOVABLE_GATEWAY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      console.error(`AI gateway failed [${upstream.status}]: ${errText}`);
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: 'AI is busy right now, please try again in a moment.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'AI service error', details: errText }), { status: upstream.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Stream to client while accumulating for DB persistence
    let fullText = '';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send conversationId as first event
        controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversationId, model })}\n\n`));

        const reader = upstream.body!.getReader();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ text: delta })}\n\n`));
                }
              } catch { /* ignore partial */ }
            }
          }

          // Persist assistant message
          if (fullText.trim()) {
            await admin.from('ai_messages').insert({
              conversation_id: conversationId,
              user_id: user.id,
              role: 'assistant',
              content: fullText,
              model,
            });
          }
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        } catch (err) {
          console.error('stream error', err);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('ai-chat fatal', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});