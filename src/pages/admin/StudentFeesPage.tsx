import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useStudentFeeInvoices } from '@/hooks/useStudentFeeInvoices';
import { FeeInvoice, FeePayment } from '@/hooks/useFeeInvoices';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordPaymentDialog } from '@/components/fees/RecordPaymentDialog';
import { PaymentReceiptDialog } from '@/components/fees/PaymentReceiptDialog';
import { ApplyDiscountDialog } from '@/components/fees/ApplyDiscountDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useFeeRealtime } from '@/hooks/useFeeRealtime';
import {
  ArrowLeft, FileText, CreditCard, Receipt, Percent, CheckCircle, AlertCircle, User, Phone, Users,
} from 'lucide-react';

function PaymentsList({ payments, openReceipt }: {
  payments: FeePayment[];
  openReceipt: (p: FeePayment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 3;
  const sorted = [...payments].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  );
  const visible = expanded ? sorted : sorted.slice(0, LIMIT);
  const hasMore = sorted.length > LIMIT;

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
        <Receipt className="w-3.5 h-3.5" /> Payment History ({payments.length})
      </h5>
      {visible.map(p => (
        <div key={p.id} className="bg-muted/30 rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">₹{Number(p.amount).toLocaleString()}</span>
            <span className="text-muted-foreground capitalize">{p.payment_method}</span>
            <span className="text-muted-foreground">{new Date(p.payment_date).toLocaleDateString('en-IN')}</span>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => openReceipt(p)}>
              <Receipt className="w-3 h-3 mr-1" /> {p.receipt_number}
            </Button>
          </div>
        </div>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show all ${sorted.length} payments`}
        </Button>
      )}
    </div>
  );
}

export default function StudentFeesPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  useFeeRealtime({
    studentId,
    scope: 'student-fees',
    enabled: !!studentId,
  });

  const { data: invoices = [], isLoading } = useStudentFeeInvoices(studentId);

  // Dialogs
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<FeeInvoice | null>(null);
  const [paymentPrefillAmount, setPaymentPrefillAmount] = useState<number | undefined>();
  const [paymentPrefillLabel, setPaymentPrefillLabel] = useState<string | undefined>();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<FeePayment | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<FeeInvoice | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountInvoice, setDiscountInvoice] = useState<FeeInvoice | null>(null);

  const loading = isLoading;

  // Compute totals. Legacy fee-table merge dropped here: useFeeInvoices
  // already represents everything the flat `fees` table tracked — see
  // useFees.ts's own migration note.
  const totals = useMemo(() => {
    let totalAmount = 0, totalPaid = 0, totalBalance = 0;
    for (const inv of invoices) {
      totalAmount += Number(inv.total_amount);
      totalPaid += Number(inv.paid_amount);
      totalBalance += Number(inv.balance);
    }
    return { totalAmount, totalPaid, totalBalance };
  }, [invoices]);

  const student: any = invoices[0]?.student;

  const openPayment = (inv: FeeInvoice, componentAmount?: number, componentLabel?: string) => {
    setPaymentInvoice(inv);
    setPaymentPrefillAmount(componentAmount);
    setPaymentPrefillLabel(componentLabel);
    setPaymentDialogOpen(true);
  };

  const openReceipt = (payment: FeePayment, invoice: FeeInvoice) => {
    setReceiptPayment(payment);
    setReceiptInvoice(invoice);
    setReceiptDialogOpen(true);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = status === 'pending' && dueDate < today;
    if (status === 'paid') return <Badge className="bg-success text-success-foreground">Paid</Badge>;
    if (isOverdue) return <Badge variant="destructive">Overdue</Badge>;
    if (status === 'partial') return <Badge className="bg-warning text-warning-foreground">Partial</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <AdminLayout title="Student Fee Details">
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/fees')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Fees
        </Button>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !student ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Student not found or no fee records</p>
          </div>
        ) : (
          <>
            {/* Student Header */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Avatar + Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 md:h-14 md:w-14 shrink-0">
                      {student.avatar_url && <AvatarImage src={student.avatar_url} alt={student.full_name} />}
                      <AvatarFallback className="text-sm md:text-base font-semibold bg-primary/10 text-primary">
                        {student.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h2 className="text-lg md:text-xl font-bold truncate">{student.full_name}</h2>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {student.admission_number} · {student.class_name}-{student.section}
                        {student.roll_number && <> · Roll #{student.roll_number}</>}
                      </p>
                      {(student.parent_name || student.parent_phone) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          {student.parent_name && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3" /> {student.parent_name}
                            </span>
                          )}
                          {student.parent_phone && (
                            <a href={`tel:${student.parent_phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                              <Phone className="w-3 h-3" /> {student.parent_phone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Fee Totals */}
                  <div className="grid grid-cols-3 gap-2 text-sm shrink-0">
                    <div className="text-center sm:text-right">
                      <p className="text-muted-foreground text-[11px] md:text-xs">Total Due</p>
                      <p className="font-bold text-base md:text-lg">₹{totals.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-muted-foreground text-[11px] md:text-xs">Paid</p>
                      <p className="font-bold text-base md:text-lg text-success">₹{totals.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-muted-foreground text-[11px] md:text-xs">Balance</p>
                      <p className="font-bold text-base md:text-lg text-destructive">₹{totals.totalBalance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                {totals.totalAmount > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={Math.round((totals.totalPaid / totals.totalAmount) * 100)} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground">{Math.round((totals.totalPaid / totals.totalAmount) * 100)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoices */}
            {invoices.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Invoices ({invoices.length})
                </h3>
                {invoices.map(inv => (
                  <Card key={inv.id}>
                    <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
                      {/* Invoice Header */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs md:text-sm text-muted-foreground">Due: {new Date(inv.due_date).toLocaleDateString('en-IN')}</span>
                          <span className="font-bold text-base md:text-lg">₹{Number(inv.total_amount).toLocaleString()}</span>
                          {getStatusBadge(inv.status, inv.due_date)}
                        </div>
                        {inv.status !== 'paid' && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setDiscountInvoice(inv); setDiscountDialogOpen(true); }}>
                              <Percent className="w-3.5 h-3.5 mr-1" /> Discount
                            </Button>
                            <Button size="sm" className="h-8 text-xs" onClick={() => openPayment(inv)}>
                              <CreditCard className="w-3.5 h-3.5 mr-1" /> Pay All
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Fee Components */}
                      {(inv.components || []).length > 0 && (
                        <table className="w-full text-sm">
                          <tbody>
                            {(inv.components || []).map(c => {
                              const componentAmount = Number(c.amount);
                              const paidForComponent = (inv.payments || []).reduce((sum, p) => {
                                const notesLower = (p.notes || '').toLowerCase();
                                const feeTypeLower = c.fee_type.toLowerCase();
                                if (notesLower.includes(feeTypeLower)) return sum + Number(p.amount);
                                return sum;
                              }, 0);
                              const remainingAmount = Math.max(0, componentAmount - paidForComponent);
                              const canPayComponent = inv.status !== 'paid' && remainingAmount > 0;
                              const payableAmount = Math.min(remainingAmount, Number(inv.balance));
                              const isFullyPaid = remainingAmount === 0;
                              return (
                                <tr key={c.id} className="border-b border-border/40 last:border-0">
                                  <td className="py-2.5 font-medium">{c.fee_type}</td>
                                  <td className="py-2.5 text-right tabular-nums">
                                    {isFullyPaid ? (
                                      <span className="inline-flex items-center gap-1 text-success font-semibold text-sm">
                                        <CheckCircle className="w-3.5 h-3.5" /> Paid
                                      </span>
                                    ) : (
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="font-bold">₹{remainingAmount.toLocaleString()}</span>
                                        {paidForComponent > 0 && (
                                          <span className="text-[11px] text-muted-foreground">of ₹{componentAmount.toLocaleString()}</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right w-20">
                                    {canPayComponent && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-3 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                                        onClick={() => openPayment(inv, payableAmount, c.fee_type)}
                                      >
                                        Pay
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Totals row */}
                            <tr className="border-t border-dashed">
                              <td colSpan={3} className="pt-2.5">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>Total: <span className="font-bold text-sm text-foreground">₹{Number(inv.total_amount).toLocaleString()}</span></span>
                                  <span>Paid: <span className="font-bold text-sm text-success">₹{Number(inv.paid_amount).toLocaleString()}</span></span>
                                  <span>Balance: <span className="font-bold text-sm text-destructive">₹{Number(inv.balance).toLocaleString()}</span></span>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      )}

                      {/* Payments */}
                      {(inv.payments || []).length > 0 && (
                        <PaymentsList
                          payments={inv.payments || []}
                          openReceipt={(p) => openReceipt(p, inv)}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {invoices.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No fee records found for this student</p>
              </div>
            )}
          </>
        )}

        {/* Dialogs */}
        <RecordPaymentDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} invoice={paymentInvoice} prefillAmount={paymentPrefillAmount} prefillLabel={paymentPrefillLabel} />
        <PaymentReceiptDialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen} payment={receiptPayment} invoice={receiptInvoice} />
        <ApplyDiscountDialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen} invoice={discountInvoice} />
      </div>
    </AdminLayout>
  );
}
