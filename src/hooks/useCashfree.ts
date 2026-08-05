import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────
// initiatePayment called invokeEdgeFunction('create-cashfree-order', ...) --
// a Supabase Edge Function that can't work post-auth-migration (no live
// Supabase session). It never reached POST /api/payment/create-order at
// all: any call here failed at the edge-function invocation itself, before
// even hitting a real endpoint. Found while investigating "Online
// Payments" as a feature area -- this is the actual payment-initiation
// call, so nothing about online payments (including the surcharge/gating
// work already built) was reachable from the real app until this was
// fixed.
//
// invoiceId/amount are all createOrder needs -- customer details and
// schoolId are derived server-side from the invoice's own student/parent
// and the caller's JWT, never trusted from the client.
// ─────────────────────────────────────────────────────────────────────────

interface InitiatePaymentParams {
  invoiceId: string;
  amount: number;
}

interface CreateOrderResponse {
  orderId: string;
  paymentSessionId: string;
  amount: number;
  surchargeAmount: number;
  totalCharge: number;
  currency: string;
  cashfreeMode: 'sandbox' | 'production';
}

// Load Cashfree JS SDK
function loadCashfreeSDK(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Cashfree) {
      resolve((window as any).Cashfree);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve((window as any).Cashfree);
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.head.appendChild(script);
  });
}

export function useCashfree() {
  const [loading, setLoading] = useState(false);

  const initiatePayment = useCallback(async (params: InitiatePaymentParams) => {
    setLoading(true);
    try {
      const { data } = await api.post<CreateOrderResponse>('/payment/create-order', {
        invoiceId: params.invoiceId,
        amount: params.amount,
      });

      const Cashfree = await loadCashfreeSDK();
      const cashfree = Cashfree({
        mode: data.cashfreeMode === 'production' ? 'production' : 'sandbox',
      });

      // Always use full-page redirect ('_self'). The Cashfree modal/iframe
      // renders a fixed desktop-width card on mobile browsers/Custom Tabs,
      // whereas the hosted checkout page is fully responsive. The page
      // navigates away here -- ParentFees.tsx picks the result back up via
      // the order_id it finds in the return_url on mount.
      await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: '_self',
      });

      return { success: true, orderId: data.orderId };
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to create payment order';
      const alreadyPaid = errorMsg.toLowerCase().includes('already paid');
      toast.error(errorMsg);
      setLoading(false);
      return { success: false, alreadyPaid };
    }
  }, []);

  return { initiatePayment, loading };
}
