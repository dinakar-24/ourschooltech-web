import { OnlinePayment } from '@/hooks/useOnlinePayments';
import { CheckCircle2, Loader2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepState = 'done' | 'active' | 'pending' | 'failed' | 'skipped';

interface Step {
  key: string;
  label: string;
  hint?: string;
  state: StepState;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function buildSteps(p: OnlinePayment): Step[] {
  const initiated: Step = {
    key: 'initiated',
    label: 'Initiated',
    hint: formatTime(p.created_at),
    state: 'done',
  };

  if (p.status === 'SUCCESS') {
    return [
      initiated,
      { key: 'processing', label: 'Processing at Cashfree', state: 'done' },
      { key: 'success', label: 'Payment Successful', hint: formatTime(p.verified_at), state: 'done' },
    ];
  }
  if (p.status === 'FAILED') {
    return [
      initiated,
      { key: 'processing', label: 'Processing at Cashfree', state: 'done' },
      // Covers both an active decline and an abandoned/expired checkout --
      // there's no separate "expired" state, an unpaid closed order is
      // just a failed attempt.
      { key: 'failed', label: 'Payment Failed', hint: p.transaction_ref || 'Try again', state: 'failed' },
    ];
  }
  // PENDING
  return [
    initiated,
    { key: 'processing', label: 'Awaiting Confirmation', hint: 'Complete payment in Cashfree', state: 'active' },
    { key: 'final', label: 'Success / Failure', state: 'pending' },
  ];
}

function StepIcon({ state }: { state: StepState }) {
  const base = 'w-5 h-5 flex-shrink-0';
  switch (state) {
    case 'done':
      return <CheckCircle2 className={cn(base, 'text-success')} />;
    case 'active':
      return <Loader2 className={cn(base, 'text-primary animate-spin')} />;
    case 'failed':
      return <XCircle className={cn(base, 'text-destructive')} />;
    case 'pending':
    default:
      return <Clock className={cn(base, 'text-muted-foreground/50')} />;
  }
}

function statusBadge(status: OnlinePayment['status']) {
  switch (status) {
    case 'SUCCESS':
      return { label: 'Success', cls: 'bg-success/10 text-success border-success/20' };
    case 'FAILED':
      return { label: 'Failed', cls: 'bg-destructive/10 text-destructive border-destructive/20' };
    case 'PENDING':
    default:
      return { label: 'Processing', cls: 'bg-primary/10 text-primary border-primary/20' };
  }
}

interface Props {
  payment: OnlinePayment;
}

export function PaymentStatusTimeline({ payment }: Props) {
  const steps = buildSteps(payment);
  const badge = statusBadge(payment.status);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Online Payment</p>
          <p className="text-sm font-semibold truncate">
            ₹{Number(payment.total_charged).toLocaleString('en-IN')}
            {payment.extra_charge > 0 && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                (incl. ₹{Number(payment.extra_charge).toLocaleString('en-IN')} fee)
              </span>
            )}
          </p>
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap', badge.cls)}>
          {badge.label}
        </span>
      </div>

      {/* Order ref */}
      {payment.cf_order_id && (
        <p className="text-[11px] text-muted-foreground font-mono truncate">
          Ref: {payment.cf_order_id}
        </p>
      )}

      {/* Timeline */}
      <ol className="relative space-y-3">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3">
              {/* Connector line */}
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[9px] top-5 bottom-[-12px] w-0.5',
                    step.state === 'done' ? 'bg-success/40' : 'bg-border'
                  )}
                  aria-hidden
                />
              )}
              <StepIcon state={step.state} />
              <div className="flex-1 min-w-0 -mt-0.5">
                <p
                  className={cn(
                    'text-sm font-medium leading-tight',
                    step.state === 'pending' && 'text-muted-foreground',
                    step.state === 'failed' && 'text-destructive'
                  )}
                >
                  {step.label}
                </p>
                {step.hint && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{step.hint}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Helper note for active */}
      {payment.status === 'PENDING' && (
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
          <span>This updates automatically when Cashfree confirms your payment. No need to refresh.</span>
        </div>
      )}
    </div>
  );
}