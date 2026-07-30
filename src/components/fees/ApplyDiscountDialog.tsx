import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useApplyDiscount } from '@/hooks/useFeeInvoices';
import { FeeInvoice } from '@/hooks/useFeeInvoices';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: FeeInvoice | null;
}

const REASONS = ['Scholarship', 'Sibling Discount', 'Staff Ward', 'Financial Aid', 'Merit-Based', 'Other'];

export function ApplyDiscountDialog({ open, onOpenChange, invoice }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const applyDiscount = useApplyDiscount();

  const balance = Number(invoice?.balance ?? 0);
  const discountAmount = Number(amount) || 0;
  const isValid = discountAmount > 0 && discountAmount <= balance && !!reason && password.length >= 8;

  const resetForm = () => {
    setAmount('');
    setReason('');
    setNotes('');
    setPassword('');
    setShowPassword(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    // No email precondition any more: verify-password identifies the caller
    // from their access token, so the old `user?.email` requirement (needed
    // only to feed signInWithPassword) would just block submission for no
    // reason.
    if (!isValid || !invoice) return;

    // Verify admin password first.
    //
    // Migrated from supabase.auth.signInWithPassword, which always errors now
    // that auth lives on Express — that made this gate fail closed and blocked
    // discounts entirely. verify-password checks the caller's own hash and
    // issues no tokens. Same shape as the SchoolsPage / DeleteSchoolDialog gates.
    setVerifying(true);
    try {
      await api.post('/auth/verify-password', { password });
    } catch (err: any) {
      toast.error(
        err?.response?.status === 401
          ? 'Incorrect password. Please try again.'
          : err?.response?.data?.error || 'Password verification failed'
      );
      return;
    } finally {
      setVerifying(false);
    }

    // Apply discount after verification
    applyDiscount.mutate(
      {
        invoice_id: invoice.id,
        student_id: invoice.student_id,
        discount_amount: discountAmount,
        reason,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          handleClose(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-warning" />
            Apply Discount
          </DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4">
            <div className="text-sm space-y-1 p-3 rounded-lg bg-muted/50 border">
              <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{invoice.student?.full_name}</span></p>
              <p><span className="text-muted-foreground">Due Date:</span> {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : 'N/A'}</p>
              <p><span className="text-muted-foreground">Balance:</span> <span className="font-bold text-base">₹{balance.toLocaleString()}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Discount Amount <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                placeholder={`Max ₹${balance.toLocaleString()}`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                max={balance}
              />
              {discountAmount > balance && (
                <p className="text-xs text-destructive">Cannot exceed balance of ₹{balance.toLocaleString()}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details..." />
            </div>

            {/* Password Verification */}
            <div className="space-y-1.5 border-t pt-4">
              <Label className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-warning" />
                Admin Password <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-1.5">Enter your password to confirm this action</p>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || applyDiscount.isPending || verifying} className="w-full sm:w-auto">
            {(applyDiscount.isPending || verifying) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Apply Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
