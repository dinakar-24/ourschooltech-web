import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Migrated off a Supabase Realtime subscription on `online_payments` -- a
// table the migrated backend never wrote to (payment.controller.js writes
// the real Payment model instead), so this always came back empty. Now
// reads GET /api/payment/online-attempts/:invoiceId, and polls instead of
// subscribing (Express has no Realtime equivalent) -- same
// Realtime-to-polling pattern as useFeeRealtime.ts, but on a short interval
// since this is specifically the "watch a live checkout in progress" view,
// and only while the latest attempt is still PENDING (nothing left to
// change once it's resolved).
const POLL_INTERVAL_MS = 5 * 1000;

export interface OnlinePayment {
  id: string;
  invoice_id: string;
  amount: number;
  extra_charge: number;
  total_charged: number;
  cf_order_id: string | null;
  cf_payment_id: string | null;
  method: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  transaction_ref: string | null;
  created_at: string;
  verified_at: string | null;
}

/**
 * Fetch online payment attempts for an invoice, newest first, polling
 * while the latest one is still in flight.
 */
export function useOnlinePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['online-payments', invoiceId],
    enabled: !!invoiceId,
    staleTime: 0,
    queryFn: async (): Promise<OnlinePayment[]> => {
      if (!invoiceId) return [];
      const { data } = await api.get<{ payments: OnlinePayment[] }>(`/payment/online-attempts/${invoiceId}`);
      return data.payments;
    },
    refetchInterval: (query) => {
      const latest = query.state.data?.[0];
      return latest && latest.status === 'PENDING' ? POLL_INTERVAL_MS : false;
    },
  });
}
