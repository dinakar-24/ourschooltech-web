import { useOnlinePayments } from '@/hooks/useOnlinePayments';
import { PaymentStatusTimeline } from './PaymentStatusTimeline';

interface Props {
  invoiceId: string;
  /** Only render if there is an active (PENDING/SUCCESS within last 24h) attempt. */
  enabled?: boolean;
}

/**
 * Loads the latest Cashfree attempt for an invoice and renders a live timeline.
 * Hides itself when there are no attempts.
 */
export function InvoicePaymentStatus({ invoiceId, enabled = true }: Props) {
  const { data: payments = [] } = useOnlinePayments(enabled ? invoiceId : undefined);

  // Show the latest attempt only. Hide failed attempts older than 1 hour to reduce noise.
  const latest = payments[0];
  if (!latest) return null;

  if (latest.status === 'FAILED') {
    const ageMs = Date.now() - new Date(latest.created_at).getTime();
    if (ageMs > 60 * 60 * 1000) return null;
  }

  return <PaymentStatusTimeline payment={latest} />;
}