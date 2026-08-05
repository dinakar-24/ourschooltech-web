import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useCashfree } from '@/hooks/useCashfree';
import { Loader2, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
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
  amount: number; // outstanding balance
  extraChargePct: number;
  extraChargeThreshold?: number | null;
  customerName?: string;
  termName?: string;
  components?: FeeComponent[];
  paidAmount?: number;
}

export function OnlinePaymentDialog({
  open, onOpenChange, invoiceId,
  amount, extraChargePct, extraChargeThreshold, customerName,
  termName, components = [], paidAmount = 0,
}: Props) {
  const isMobile = useIsMobile();
  const { initiatePayment, loading } = useCashfree();
  const [payableAmount, setPayableAmount] = useState(0);

  // Reset on open
  useEffect(() => {
    if (open) setPayableAmount(0);
  }, [open]);

  const handleAmountChange = useCallback((amt: number) => setPayableAmount(amt), []);

  // Cap to balance
  const cappedAmount = Math.min(Math.round(payableAmount * 100) / 100, amount);
  // Preview only -- the actual charge is computed server-side in
  // createOrder from the school's own resolved config, this just needs to
  // match that math so the parent isn't surprised at checkout. Surcharge
  // applies only to the amount above the school's surcharge-free threshold.
  const excessOverThreshold = Math.max(0, cappedAmount - (extraChargeThreshold ?? Infinity));
  const extraCharge = Math.round((excessOverThreshold * extraChargePct / 100) * 100) / 100;
  const totalPayable = cappedAmount + extraCharge;
  const isValid = cappedAmount > 0;

  const handlePay = async () => {
    if (!isValid) return;
    const result = await initiatePayment({ invoiceId, amount: cappedAmount });
    if (result.success || result.alreadyPaid) {
      onOpenChange(false);
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Student Info */}
      {customerName && (
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-sm font-medium text-foreground">{customerName}</p>
          {termName && <p className="text-xs text-muted-foreground mt-0.5">{termName}</p>}
        </div>
      )}

      {/* Fee selection */}
      <FeeComponentSelector
        components={components}
        paidAmount={paidAmount}
        maxAmount={amount}
        onAmountChange={handleAmountChange}
      />

      {/* Amount Summary */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Fee Amount</span>
          <span className="font-medium">₹{cappedAmount.toLocaleString('en-IN')}</span>
        </div>
        {extraCharge > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gateway Charges ({extraChargePct}%)</span>
            <span className="font-medium">₹{extraCharge.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="border-t border-border/60 pt-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold">Total Payable</span>
          <span className="text-lg font-bold text-primary">₹{totalPayable.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Validation warning */}
      {!isValid && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Select at least one fee to pay</span>
        </div>
      )}

      {/* Security badge */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/5 text-success text-xs">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Secure payment powered by Cashfree</span>
      </div>

      {/* Pay button */}
      <Button
        onClick={handlePay}
        disabled={loading || !isValid}
        className="w-full h-12 text-sm font-semibold"
        size="lg"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4 mr-2" />
        )}
        {isValid ? `Pay ₹${totalPayable.toLocaleString('en-IN')}` : 'Select fees to pay'}
      </Button>
    </div>
  );

  const title = `Pay Online${termName ? ` — ${termName}` : ''}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base">{title}</DrawerTitle>
          </DrawerHeader>
          <div data-vaul-no-drag className="px-4 pb-6 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
