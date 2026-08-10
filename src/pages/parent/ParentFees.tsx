import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useParentData } from '@/hooks/useParentData';
import { useParentInvoices, ParentInvoice } from '@/hooks/useParentInvoices';
import { useParentPaymentSubmissions } from '@/hooks/usePaymentSubmissions';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { useFeeRealtime } from '@/hooks/useFeeRealtime';
import { PaymentReceiptDialog } from '@/components/fees/PaymentReceiptDialog';
import { SubmitPaymentDialog } from '@/components/fees/SubmitPaymentDialog';
import { OnlinePaymentDialog } from '@/components/fees/OnlinePaymentDialog';
import { InvoicePaymentStatus } from '@/components/fees/InvoicePaymentStatus';
import { FeeInvoice, FeePayment } from '@/hooks/useFeeInvoices';
import { allocateComponentBalances } from '@/lib/fee-waterfall';
import {
  CreditCard, CheckCircle, AlertCircle, Clock, IndianRupee, TrendingUp,
  Loader2, Receipt, Building2, Percent, ChevronDown, ChevronRight, Send, Wifi,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function ParentFees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { childProfile, fees, isLoading } = useParentData();
  const { data: invoices = [], isLoading: invoicesLoading } = useParentInvoices(childProfile?.id);
  const { data: submissions = [] } = useParentPaymentSubmissions(childProfile?.id);
  const { data: payConfig } = usePaymentConfig();

  useFeeRealtime({
    studentId: childProfile?.id,
    scope: 'parent-fees',
    enabled: !!childProfile?.id,
  });

  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<FeePayment | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<FeeInvoice | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitInvoice, setSubmitInvoice] = useState<ParentInvoice | null>(null);
  const [submitPrefillAmount, setSubmitPrefillAmount] = useState<number | undefined>();
  const [submitPrefillLabel, setSubmitPrefillLabel] = useState<string | undefined>();
  const [onlinePayOpen, setOnlinePayOpen] = useState(false);
  const [onlinePayInvoice, setOnlinePayInvoice] = useState<ParentInvoice | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle return from Cashfree's full-page redirect. The redirect itself
  // carries no reliable outcome (Cashfree doesn't append a payment_status
  // param), so the real status has to be fetched -- this is the only
  // caller of GET /payment/status/:orderId, which also reconciles our own
  // Payment row (marks it SUCCESS/FAILED) as a safety net alongside the
  // webhook.
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId) return;

    (async () => {
      try {
        const { data } = await api.get<{ status: 'PENDING' | 'SUCCESS' | 'FAILED' | string }>(`/payment/status/${orderId}`);

        if (data.status === 'SUCCESS') {
          toast.success('Payment successful! Your receipt is available below.');
        } else if (data.status === 'FAILED') {
          toast.error('Payment was not completed. Please try again.');
        }
        // PENDING: say nothing here -- InvoicePaymentStatus's live timeline
        // (and the webhook, async) will pick it up shortly.
      } catch {
        // Non-critical -- the invoice list and live timeline still reflect
        // the real state once the webhook (or a later poll) lands.
      } finally {
        queryClient.invalidateQueries({ queryKey: ['parent-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['parent-data'] });
        queryClient.invalidateQueries({ queryKey: ['online-payments'] });
        setSearchParams({}, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  // Invoice-based stats
  const invoiceStats = {
    totalAmount: invoices.reduce((s, i) => s + Number(i.total_amount), 0),
    totalPaid: invoices.reduce((s, i) => s + Number(i.paid_amount), 0),
    totalBalance: invoices.reduce((s, i) => s + Number(i.balance), 0),
  };

  // Legacy fees stats
  const legacyStats = {
    pending: fees.filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.amount), 0),
    paid: fees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0),
  };

  const totalPending = invoiceStats.totalBalance + legacyStats.pending;
  const totalPaid = invoiceStats.totalPaid + legacyStats.paid;
  const grandTotal = invoiceStats.totalAmount + legacyStats.pending + legacyStats.paid;
  const paidPercentage = grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 0;

  const today = new Date().toISOString().split('T')[0];

  // Helper: get submissions for an invoice
  const getInvoiceSubmissions = (invoiceId: string) =>
    submissions.filter(s => s.invoice_id === invoiceId);

  const openReceipt = (payment: ParentInvoice['payments'][0], invoice: ParentInvoice) => {
    setReceiptPayment({
      ...payment,
      invoice_id: invoice.id,
      student_id: invoice.student_id,
      school_id: '',
      cheque_number: null,
      cheque_date: null,
      bank_name: null,
      received_by: null,
    } as FeePayment);
    setReceiptInvoice({
      ...invoice,
      school_id: '',
      created_at: '',
      student: childProfile ? {
        id: childProfile.id,
        full_name: childProfile.full_name,
        class_name: childProfile.class_name,
        section: childProfile.section,
        admission_number: childProfile.admission_number,
      } : undefined,
    } as FeeInvoice);
    setReceiptOpen(true);
  };

  const openSubmitPayment = (inv: ParentInvoice, prefillAmt?: number, prefillLbl?: string) => {
    setSubmitInvoice(inv);
    setSubmitPrefillAmount(prefillAmt);
    setSubmitPrefillLabel(prefillLbl);
    setSubmitDialogOpen(true);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === 'pending' && dueDate < today;
    if (status === 'paid') return <Badge className="bg-success text-success-foreground text-xs">Paid</Badge>;
    if (isOverdue) return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    if (status === 'partial') return <Badge className="bg-warning text-warning-foreground text-xs">Partial</Badge>;
    return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  };

  if (isLoading || invoicesLoading) {
    return (
      <MobileLayout title="Fees" showBack>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  const pendingLegacy = fees.filter(f => f.status !== 'paid');
  const paidLegacy = fees.filter(f => f.status === 'paid');

  return (
    <MobileLayout title="Fees" showBack>
      <div className="p-4 space-y-3">
        {/* Summary Card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-primary-foreground/70">Pending Fees</p>
              <p className="text-2xl font-extrabold tracking-tight mt-0.5">₹{totalPending.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          {grandTotal > 0 && (
            <div className="mt-2.5 space-y-1">
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/70 transition-all"
                  style={{ width: `${paidPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-primary-foreground/70">
                {paidPercentage}% paid · ₹{totalPaid.toLocaleString('en-IN')} of ₹{grandTotal.toLocaleString('en-IN')}
              </p>
            </div>
          )}
          {totalPending > 0 && (
            <div className="flex items-center gap-2 mt-2.5 p-2.5 rounded-lg bg-white/10 text-xs">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
              <span className="text-primary-foreground/90">Pay via UPI and submit proof, or visit school office</span>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-success" />
            </div>
            <p className="text-lg font-bold text-foreground">
              ₹{totalPaid >= 100000 ? `${(totalPaid / 100000).toFixed(1)}L` : totalPaid >= 1000 ? `${(totalPaid / 1000).toFixed(0)}K` : totalPaid.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-muted-foreground">Paid This Year</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">{paidPercentage}%</p>
            <p className="text-xs text-muted-foreground">Payment Progress</p>
          </div>
        </div>

        {/* Invoice-Based Fees */}
        {invoices.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Fee Invoices
            </h3>
            <div className="space-y-3">
              {invoices.map((inv) => {
                const isOverdue = inv.status === 'pending' && inv.due_date < today;
                const payPct = Number(inv.total_amount) > 0
                  ? Math.round((Number(inv.paid_amount) / Number(inv.total_amount)) * 100)
                  : 0;
                const invSubmissions = getInvoiceSubmissions(inv.id);
                const hasPending = invSubmissions.some(s => s.status === 'pending');
                const rejectedSubmissions = invSubmissions.filter(s => s.status === 'rejected');
                const canSubmit = inv.status !== 'paid' && Number(inv.balance) > 0 && !hasPending;

                return (
                  <Collapsible
                    key={inv.id}
                    open={expandedInvoice === inv.id}
                    onOpenChange={(open) => setExpandedInvoice(open ? inv.id : null)}
                  >
                    <div className={`rounded-xl border bg-card overflow-hidden ${isOverdue ? 'border-warning/60' : 'border-border/60'}`}>
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {expandedInvoice === inv.id
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              <span className="text-sm font-medium text-muted-foreground">Due: {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {hasPending && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0.5">
                                  <Clock className="w-2.5 h-2.5 mr-0.5" /> Verifying
                                </Badge>
                              )}
                              {getStatusBadge(inv.status, inv.due_date)}
                            </div>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div className="flex items-center gap-1.5">
                              {(inv.components || []).length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {(inv.components || []).length} item{(inv.components || []).length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <span className="text-2xl font-bold text-foreground">₹{Number(inv.total_amount).toLocaleString('en-IN')}</span>
                          </div>
                          {Number(inv.total_amount) > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <Progress value={payPct} className="h-1.5" />
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>Paid: ₹{Number(inv.paid_amount).toLocaleString('en-IN')}</span>
                                <span>Balance: ₹{Number(inv.balance).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                          {/* Live online payment status */}
                          <InvoicePaymentStatus invoiceId={inv.id} />

                          {/* Payment Buttons */}
                          {canSubmit && (
                            <div className="flex gap-2">
                              {payConfig?.onlineEnabled && (
                                <Button
                                  className="flex-1 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOnlinePayInvoice(inv);
                                    setOnlinePayOpen(true);
                                  }}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  Pay Online
                                </Button>
                              )}
                              {payConfig?.manualEnabled && (
                                <Button
                                  variant={payConfig?.onlineEnabled ? "outline" : "default"}
                                  className="flex-1 rounded-lg"
                                  onClick={(e) => { e.stopPropagation(); openSubmitPayment(inv); }}
                                >
                                  <Send className="w-4 h-4 mr-2" />
                                  Manual Pay
                                </Button>
                              )}
                            </div>
                          )}
                          {canSubmit && (
                            <p className="text-xs text-muted-foreground text-center">
                              Balance: ₹{Number(inv.balance).toLocaleString('en-IN')}
                              {payConfig?.onlineEnabled && payConfig.surchargePct > 0 && (
                                <span> · Online: +{payConfig.surchargePct}% gateway fee{payConfig.surchargeFreeThreshold ? ` above ₹${payConfig.surchargeFreeThreshold}` : ''}</span>
                              )}
                            </p>
                          )}

                          {/* Pending verification notice */}
                          {hasPending && (
                            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
                              <Clock className="w-4 h-4 flex-shrink-0" />
                              <span>Payment proof submitted — awaiting admin verification</span>
                            </div>
                          )}

                          {/* Rejected submissions */}
                          {rejectedSubmissions.map(rs => (
                            <div key={rs.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 text-destructive text-sm">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium">Payment rejected</p>
                                <p className="text-xs mt-0.5">{rs.rejection_reason || 'No reason provided'}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  ₹{Number(rs.amount).toLocaleString('en-IN')} · UTR: {rs.transaction_id}
                                </p>
                              </div>
                            </div>
                          ))}

                          {/* Fee Breakdown - Clean Cards */}
                          {(inv.components || []).length > 0 && (() => {
                            const balances = allocateComponentBalances(
                              (inv.components || []).map(c => ({ id: c.id, fee_type: c.fee_type, amount: Number(c.amount) })),
                              (inv.payments || []).map(p => ({ amount: Number(p.amount), fee_item_id: p.fee_item_id }))
                            );
                            return (
                              <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fee Breakdown</p>
                                <div className="rounded-lg border border-border/40 overflow-hidden divide-y divide-border/40">
                                  {balances.map(c => (
                                    <div key={c.id} className="flex items-center justify-between px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${c.remaining <= 0 ? 'bg-success' : 'bg-warning'}`} />
                                        <span className="text-sm text-foreground">{c.fee_type}</span>
                                      </div>
                                      {c.remaining <= 0 ? (
                                        <span className="text-xs text-success font-medium">Paid ✓</span>
                                      ) : (
                                        <span className="text-sm font-semibold text-foreground">₹{c.remaining.toLocaleString('en-IN')}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Discounts */}
                          {(inv.discounts || []).length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Percent className="w-3 h-3" /> Discounts Applied
                              </p>
                              <div className="space-y-1">
                                {(inv.discounts || []).map(d => (
                                  <div key={d.id} className="flex justify-between text-sm py-1.5 px-3 bg-success/5 rounded-lg text-success">
                                    <span>{d.reason}</span>
                                    <span className="font-medium">-₹{Number(d.discount_amount).toLocaleString('en-IN')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Payments */}
                          {(inv.payments || []).length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment History</p>
                              <div className="space-y-2">
                                {(inv.payments || []).map(p => (
                                  <div key={p.id} className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-sm text-foreground">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-muted-foreground capitalize">{p.payment_method}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs px-2 text-primary"
                                        onClick={(e) => { e.stopPropagation(); openReceipt(p, inv); }}
                                      >
                                        <Receipt className="w-3 h-3 mr-1" /> {p.receipt_number}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy Pending Fees */}
        {pendingLegacy.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Pending & Upcoming
            </h3>
            <div className="space-y-2.5">
              {pendingLegacy.map((fee) => {
                const isOverdue = fee.due_date < today;
                return (
                  <div key={fee.id} className={`rounded-xl border bg-card p-4 ${isOverdue ? 'border-warning/60' : 'border-border/60'}`}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        {isOverdue ? (
                          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-warning" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-foreground">{fee.fee_type}</span>
                      </div>
                      <Badge variant={isOverdue ? 'default' : 'secondary'} className="text-[10px]">
                        {isOverdue ? 'overdue' : 'pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-foreground">₹{Number(fee.amount).toLocaleString('en-IN')}</span>
                      <span className="text-xs text-muted-foreground">
                        Due: {new Date(fee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" />
                      Pay at school office · Cash / UPI / Bank Transfer
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy Payment History */}
        {paidLegacy.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Payment History
            </h3>
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/50">
              {paidLegacy.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{payment.fee_type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {payment.paid_date
                          ? new Date(payment.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Paid'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-foreground">₹{Number(payment.amount).toLocaleString('en-IN')}</p>
                    {(payment as any).receipt_number && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                        <Receipt className="w-3 h-3" />
                        {(payment as any).receipt_number}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoices.length === 0 && fees.length === 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-10 text-center">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No fee records found</p>
          </div>
        )}
      </div>

      {/* Receipt Dialog */}
      <PaymentReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        payment={receiptPayment}
        invoice={receiptInvoice}
      />

      {/* Submit Payment Dialog */}
      {submitInvoice && (
        <SubmitPaymentDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          invoiceId={submitInvoice.id}
          studentId={submitInvoice.student_id}
          schoolId={user?.schoolId || ''}
          maxAmount={Number(submitInvoice.balance)}
          termName={`Due ${new Date(submitInvoice.due_date).toLocaleDateString('en-IN')}`}
          prefillAmount={submitPrefillAmount}
          prefillLabel={submitPrefillLabel}
          components={(submitInvoice.components || []).map(c => ({
            id: c.id,
            fee_type: c.fee_type,
            amount: Number(c.amount),
          }))}
          paidAmount={Number(submitInvoice.total_amount) - Number(submitInvoice.balance)}
        />
      )}

      {/* Online Payment Dialog */}
      {onlinePayInvoice && (
        <OnlinePaymentDialog
          open={onlinePayOpen}
          onOpenChange={setOnlinePayOpen}
          invoiceId={onlinePayInvoice.id}
          amount={Number(onlinePayInvoice.balance)}
          extraChargePct={payConfig?.surchargePct ?? 0}
          extraChargeThreshold={payConfig?.surchargeFreeThreshold}
          customerName={childProfile?.parent_name || childProfile?.full_name}
          termName={`Due ${new Date(onlinePayInvoice.due_date).toLocaleDateString('en-IN')}`}
          components={(onlinePayInvoice.components || []).map(c => ({
            id: c.id,
            fee_type: c.fee_type,
            amount: Number(c.amount),
          }))}
          customerPhone={childProfile?.parent_phone || childProfile?.alternate_phone || undefined}
          paidAmount={Number(onlinePayInvoice.total_amount) - Number(onlinePayInvoice.balance)}
        />
      )}
    </MobileLayout>
  );
}
