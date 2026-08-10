import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRecordInvoicePayment, FeeInvoice } from '@/hooks/useFeeInvoices';
import { useAuth } from '@/contexts/AuthContext';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: FeeInvoice | null;
  prefillAmount?: number;
  prefillLabel?: string;
  // Real FeeInvoiceItem id for the component this dialog was opened to pay
  // (set together with prefillLabel by the "Pay <component>" buttons) --
  // sent through so the payment is attributed to that exact component
  // instead of being guessed later by the order-based waterfall.
  prefillItemId?: string;
  // Fired with the newly created payment (camelCase, straight off the API
  // response) once recording succeeds, so the caller can show its receipt
  // immediately instead of making the admin go find it in Payment History.
  onPaid?: (payment: { id: string; receiptNo: string | null }) => void;
}

export function RecordPaymentDialog({ open, onOpenChange, invoice, prefillAmount, prefillLabel, prefillItemId, onPaid }: RecordPaymentDialogProps) {
  const { user } = useAuth();
  const recordPayment = useRecordInvoicePayment();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [transactionId, setTransactionId] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState<Date | undefined>();
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-fill amount when dialog opens with a specific component amount
  useEffect(() => {
    if (open && prefillAmount && prefillAmount > 0) {
      setAmount(String(prefillAmount));
      if (prefillLabel) {
        setNotes(`Payment for ${prefillLabel}`);
      }
    }
  }, [open, prefillAmount, prefillLabel]);

  const resetForm = () => {
    setAmount('');
    setPaymentMethod('cash');
    setPaymentDate(new Date());
    setTransactionId('');
    setChequeNumber('');
    setChequeDate(undefined);
    setBankName('');
    setNotes('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const isCash = paymentMethod === 'cash';
  const isCheque = paymentMethod === 'cheque';
  const isDigital = ['upi', 'card', 'neft'].includes(paymentMethod);

  const canSubmit = () => {
    if (!invoice || !amount || Number(amount) <= 0) return false;
    const allowedMax = Number(prefillAmount || invoice.balance || 0);
    if (Number(amount) > allowedMax) return false;
    if (isDigital && !transactionId.trim()) return false;
    if (isCheque && (!chequeNumber.trim() || !bankName.trim() || !chequeDate)) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!invoice || !canSubmit()) return;

    try {
      const paid = await recordPayment.mutateAsync({
        invoice_id: invoice.id,
        student_id: invoice.student_id,
        amount: Number(amount),
        payment_method: paymentMethod,
        transaction_id: isDigital ? transactionId : undefined,
        cheque_number: isCheque ? chequeNumber : undefined,
        cheque_date: isCheque && chequeDate ? format(chequeDate, 'yyyy-MM-dd') : undefined,
        bank_name: (isCheque || isDigital) && bankName ? bankName : undefined,
        payment_date: format(paymentDate, 'yyyy-MM-dd'),
        received_by: isCash ? (user?.name || 'Staff') : undefined,
        notes: notes || undefined,
        fee_item_id: prefillItemId,
      });
      handleClose(false);
      onPaid?.(paid);
    } catch {
      // handled by hook
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {prefillLabel ? `Pay ${prefillLabel}` : 'Record Payment'}
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Student</span>
            <span className="font-medium">{invoice.student?.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Due Date</span>
            <span className="font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span>₹{Number(invoice.total_amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Paid</span>
            <span className="text-success">₹{Number(invoice.paid_amount).toLocaleString()}</span>
          </div>
          {prefillLabel && prefillAmount && (
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="text-muted-foreground">{prefillLabel} Remaining</span>
              <span className="font-semibold text-primary">₹{Number(prefillAmount).toLocaleString()}</span>
            </div>
          )}
          <div className={`flex justify-between font-semibold text-base ${!prefillLabel ? 'border-t pt-2 mt-1' : ''}`}>
            <span>Balance Due</span>
            <span className="text-destructive">₹{Number(invoice.balance).toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount Paying (₹) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              placeholder={`Max ₹${prefillLabel && prefillAmount ? Number(prefillAmount).toLocaleString() : Number(invoice.balance).toLocaleString()}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={prefillAmount || invoice.balance}
            />
            {Number(amount) > Number(invoice.balance) && (
              <p className="text-xs text-destructive">Amount exceeds balance of ₹{Number(invoice.balance).toLocaleString()}</p>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method <span className="text-destructive">*</span></Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="neft">NEFT / RTGS</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCash && (
            <div className="rounded-lg border bg-success/5 p-3 text-sm space-y-1">
              <p className="text-muted-foreground">Receipt Number will be auto-generated</p>
              <p className="text-muted-foreground">Received By: <span className="font-medium text-foreground">{user?.name || 'Staff'}</span></p>
            </div>
          )}

          {isDigital && (
            <>
              <div className="space-y-2">
                <Label>Transaction ID <span className="text-destructive">*</span></Label>
                <Input placeholder="Enter transaction/reference ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bank Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
            </>
          )}

          {isCheque && (
            <>
              <div className="space-y-2">
                <Label>Cheque Number <span className="text-destructive">*</span></Label>
                <Input placeholder="Enter cheque number" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bank Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cheque Date <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !chequeDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {chequeDate ? format(chequeDate, 'PPP') : 'Select cheque date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={chequeDate} onSelect={setChequeDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="Any remarks" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit() || recordPayment.isPending}>
            {recordPayment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Record Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
