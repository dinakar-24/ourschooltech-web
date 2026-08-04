import { useState, useMemo, useEffect, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, IndianRupee, AlertCircle } from 'lucide-react';
import { computeComponentBalances, type FeeComponentBalance } from '@/lib/fee-waterfall';

interface FeeComponent {
  id: string;
  fee_type: string;
  amount: number;
}

interface FeeComponentSelectorProps {
  components: FeeComponent[];
  paidAmount: number;
  maxAmount: number; // invoice balance
  onAmountChange: (amount: number) => void;
  onSelectedLabelsChange?: (labels: string) => void;
  // Real FeeInvoiceItem ids for whichever components are currently selected
  // -- kept alongside the human-readable labels above (not a replacement)
  // so a submitted payment proof can link to actual line items instead of
  // only a derived text description.
  onSelectedItemIdsChange?: (ids: string[]) => void;
}

export function FeeComponentSelector({
  components,
  paidAmount,
  maxAmount,
  onAmountChange,
  onSelectedLabelsChange,
  onSelectedItemIdsChange,
}: FeeComponentSelectorProps) {
  const [mode, setMode] = useState<'select' | 'custom'>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customComponentId, setCustomComponentId] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const componentBalances = useMemo(
    () => computeComponentBalances(components, paidAmount),
    [components, paidAmount]
  );

  const unpaidComponents = useMemo(
    () => componentBalances.filter(c => c.remaining > 0),
    [componentBalances]
  );

  const paidComponents = useMemo(
    () => componentBalances.filter(c => c.remaining <= 0),
    [componentBalances]
  );

  // Auto-select all unpaid on mount
  useEffect(() => {
    const ids = new Set(unpaidComponents.map(c => c.id));
    setSelectedIds(ids);
    setMode('select');
    setCustomComponentId(unpaidComponents[0]?.id || '');
    setCustomAmount('');
  }, [unpaidComponents.length]); // Only reset on component count change

  // Calculate and emit amount
  const selectedTotal = useMemo(() => {
    if (mode === 'custom') {
      const amt = parseFloat(customAmount) || 0;
      const comp = unpaidComponents.find(c => c.id === customComponentId);
      const compMax = comp?.remaining || maxAmount;
      return Math.min(amt, compMax, maxAmount);
    }
    return unpaidComponents
      .filter(c => selectedIds.has(c.id))
      .reduce((s, c) => s + c.remaining, 0);
  }, [mode, selectedIds, unpaidComponents, customAmount, customComponentId, maxAmount]);

  const payableAmount = Math.min(Math.round(selectedTotal * 100) / 100, maxAmount);

  useEffect(() => {
    onAmountChange(payableAmount);
  }, [payableAmount, onAmountChange]);

  // Emit labels
  useEffect(() => {
    if (!onSelectedLabelsChange) return;
    if (mode === 'custom') {
      const comp = unpaidComponents.find(c => c.id === customComponentId);
      onSelectedLabelsChange(comp ? `Partial: ${comp.fee_type}` : 'Custom amount');
    } else {
      const labels = unpaidComponents
        .filter(c => selectedIds.has(c.id))
        .map(c => c.fee_type)
        .join(', ');
      onSelectedLabelsChange(labels);
    }
  }, [mode, selectedIds, customComponentId, unpaidComponents, onSelectedLabelsChange]);

  // Emit item ids -- same selection, real FeeInvoiceItem ids instead of labels
  useEffect(() => {
    if (!onSelectedItemIdsChange) return;
    if (mode === 'custom') {
      onSelectedItemIdsChange(customComponentId ? [customComponentId] : []);
    } else {
      onSelectedItemIdsChange(unpaidComponents.filter(c => selectedIds.has(c.id)).map(c => c.id));
    }
  }, [mode, selectedIds, customComponentId, unpaidComponents, onSelectedItemIdsChange]);

  const toggleComponent = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = unpaidComponents.length > 0 && unpaidComponents.every(c => selectedIds.has(c.id));

  const customMaxForSelected = useMemo(() => {
    const comp = unpaidComponents.find(c => c.id === customComponentId);
    return comp?.remaining || maxAmount;
  }, [customComponentId, unpaidComponents, maxAmount]);

  if (unpaidComponents.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
        <p className="text-2xl font-bold text-foreground">₹{maxAmount.toLocaleString('en-IN')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Select Fees to Pay
        </p>
        {mode === 'select' && (
          <button
            type="button"
            className="text-xs text-primary font-medium"
            onClick={() => {
              if (allSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(unpaidComponents.map(c => c.id)));
            }}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Unpaid components */}
      <div className="space-y-1.5">
        {unpaidComponents.map(c => {
          const checked = selectedIds.has(c.id);
          const isPartiallyPaid = c.paid > 0;
          const disabled = mode === 'custom';
          return (
            <label
              key={c.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                disabled
                  ? 'border-border/40 bg-muted/20 opacity-50 cursor-default'
                  : checked
                    ? 'border-primary/40 bg-primary/5 cursor-pointer'
                    : 'border-border/60 bg-card hover:bg-muted/30 cursor-pointer'
              }`}
            >
              <Checkbox
                checked={checked && !disabled}
                onCheckedChange={() => !disabled && toggleComponent(c.id)}
                disabled={disabled}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{c.fee_type}</span>
                {isPartiallyPaid && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    ₹{c.paid.toLocaleString('en-IN')} paid of ₹{c.original_amount.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              <span className="text-sm font-bold text-foreground whitespace-nowrap">
                ₹{c.remaining.toLocaleString('en-IN')}
              </span>
            </label>
          );
        })}
      </div>

      {/* Paid components */}
      {paidComponents.length > 0 && (
        <div className="pt-0.5 space-y-1">
          {paidComponents.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 opacity-60">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              <span className="flex-1 text-sm text-muted-foreground">{c.fee_type}</span>
              <span className="text-xs text-success font-medium">Paid ✓</span>
            </div>
          ))}
        </div>
      )}

      {/* Custom amount toggle */}
      <label className="flex items-center gap-2 pt-1 cursor-pointer">
        <Checkbox
          checked={mode === 'custom'}
          onCheckedChange={(v) => {
            setMode(v ? 'custom' : 'select');
            if (!v) setCustomAmount('');
          }}
        />
        <span className="text-xs text-muted-foreground">Pay a custom partial amount</span>
      </label>

      {/* Custom amount controls */}
      {mode === 'custom' && (
        <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
          {unpaidComponents.length > 1 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Apply payment to</p>
              <Select value={customComponentId} onValueChange={setCustomComponentId}>
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue placeholder="Select fee" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidComponents.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fee_type} — ₹{c.remaining.toLocaleString('en-IN')} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Amount (max ₹{customMaxForSelected.toLocaleString('en-IN')})
            </p>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                max={customMaxForSelected}
                min={1}
                className="pl-9 text-lg font-semibold h-11 bg-card"
                placeholder={`Enter amount`}
                autoFocus
              />
            </div>
          </div>
          {parseFloat(customAmount) > customMaxForSelected && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="w-3 h-3" />
              <span>Amount capped to ₹{customMaxForSelected.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
