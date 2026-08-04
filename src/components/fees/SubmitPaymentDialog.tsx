import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubmitPayment } from '@/hooks/usePaymentSubmissions';
import { uploadToR2 } from '@/lib/uploads';
import { Loader2, Upload, Camera, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { FeeComponentSelector } from './FeeComponentSelector';

interface FeeComponent {
  id: string;
  fee_type: string;
  amount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  studentId: string;
  schoolId: string;
  maxAmount: number;
  termName?: string;
  prefillAmount?: number;
  prefillLabel?: string;
  components?: FeeComponent[];
  paidAmount?: number;
}

export function SubmitPaymentDialog({
  open, onOpenChange, invoiceId, studentId, schoolId,
  maxAmount, termName, components = [], paidAmount = 0,
}: Props) {
  const [payableAmount, setPayableAmount] = useState(0);
  const [feeLabels, setFeeLabels] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('phonepe');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const isMobile = useIsMobile();
  const submitPayment = useSubmitPayment();

  useEffect(() => {
    if (open) {
      setPaymentMethod('phonepe');
      setTransactionId('');
      setNotes('');
      setScreenshotFile(null);
    }
  }, [open]);

  const handleAmountChange = useCallback((amt: number) => setPayableAmount(amt), []);
  const handleLabelsChange = useCallback((labels: string) => setFeeLabels(labels), []);
  const handleItemIdsChange = useCallback((ids: string[]) => setSelectedItemIds(ids), []);

  const isValid = payableAmount > 0 && transactionId.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    if (payableAmount > maxAmount) {
      toast.error(`Amount cannot exceed ₹${maxAmount.toLocaleString('en-IN')}`);
      return;
    }

    let screenshotUrl: string | undefined;
    if (screenshotFile) {
      setUploading(true);
      const ext = screenshotFile.name.split('.').pop();
      const key = `payment-proofs/${schoolId}/${invoiceId}/${Date.now()}.${ext}`;
      try {
        const result = await uploadToR2(key, screenshotFile, screenshotFile.type);
        screenshotUrl = result.key; // private folder -- store the key, viewed later via a signed URL
      } catch (err: any) {
        toast.error('Screenshot upload failed: ' + (err.message || 'Unknown error'));
        return;
      } finally {
        setUploading(false);
      }
    }

    const autoNote = feeLabels ? `Payment for: ${feeLabels}` : '';
    const finalNotes = [autoNote, notes.trim()].filter(Boolean).join(' · ');

    submitPayment.mutate({
      school_id: schoolId,
      invoice_id: invoiceId,
      student_id: studentId,
      amount: payableAmount,
      payment_method: paymentMethod,
      transaction_id: transactionId.trim(),
      screenshot_url: screenshotUrl,
      notes: finalNotes || undefined,
      fee_invoice_item_ids: selectedItemIds.length > 0 ? selectedItemIds : undefined,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const isSubmitting = submitPayment.isPending || uploading;

  const formContent = (
    <div className="space-y-4">
      {/* Fee selection */}
      <FeeComponentSelector
        components={components}
        paidAmount={paidAmount}
        maxAmount={maxAmount}
        onAmountChange={handleAmountChange}
        onSelectedLabelsChange={handleLabelsChange}
        onSelectedItemIdsChange={handleItemIdsChange}
      />

      {/* Amount summary */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Amount to Submit</span>
          <span className="text-lg font-bold text-primary">₹{payableAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <Label className="text-sm font-medium">Payment App</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger className="mt-1 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="phonepe">PhonePe</SelectItem>
            <SelectItem value="gpay">Google Pay</SelectItem>
            <SelectItem value="paytm">Paytm</SelectItem>
            <SelectItem value="upi_other">Other UPI</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* UTR */}
      <div>
        <Label className="text-sm font-medium">UTR / Transaction ID *</Label>
        <Input
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          placeholder="Enter 12-digit UTR number"
          maxLength={50}
          className="mt-1 h-11"
        />
        <p className="text-xs text-muted-foreground mt-1">Find this in your payment app's transaction details</p>
      </div>

      {/* Screenshot */}
      <div>
        <Label className="text-sm font-medium">Payment Screenshot (optional)</Label>
        <div className="mt-1">
          <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-3.5 hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
            />
            {screenshotFile ? (
              <div className="flex items-center gap-2 text-sm">
                <Camera className="w-4 h-4 text-success" />
                <span className="truncate">{screenshotFile.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                <span>Tap to upload screenshot</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="text-sm font-medium">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional info..."
          rows={2}
          maxLength={500}
          className="mt-1"
        />
      </div>

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={isSubmitting || !isValid} className="w-full h-12 text-sm font-semibold" size="lg">
        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
        {payableAmount > 0 ? `Submit ₹${payableAmount.toLocaleString('en-IN')} Proof` : 'Select fees to pay'}
      </Button>
    </div>
  );

  const title = `Submit Payment${termName ? ` — ${termName}` : ''}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base">{title}</DrawerTitle>
          </DrawerHeader>
          <div data-vaul-no-drag className="px-4 pb-6 overflow-y-auto flex-1 min-h-0">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
