import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, CreditCard, Lock, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { useSchoolPaymentConfig, useUpdatePaymentConfig } from '@/hooks/usePaymentConfig';

export function PaymentConfigSection() {
  const { data, isLoading } = useSchoolPaymentConfig();
  const updateMutation = useUpdatePaymentConfig();

  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [manualEnabled, setManualEnabled] = useState(true);
  const [threshold, setThreshold] = useState('');

  useEffect(() => {
    if (data?.config) {
      setOnlineEnabled(data.config.onlineEnabled);
      setManualEnabled(data.config.manualEnabled);
      setThreshold(String(data.config.surchargeFreeThreshold));
    }
  }, [data?.config]);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  const hasConfig = !!data?.config;
  const effective = data?.effective;
  const onlineOverridden = data?.config?.superAdminOverrideOnline !== null && data?.config?.superAdminOverrideOnline !== undefined;
  const manualOverridden = data?.config?.superAdminOverrideManual !== null && data?.config?.superAdminOverrideManual !== undefined;

  const handleInitialSave = () => {
    const parsed = parseFloat(threshold);
    if (!threshold.trim() || isNaN(parsed) || parsed < 0) {
      toast.error('Enter a valid surcharge-free threshold');
      return;
    }
    updateMutation.mutate({ onlineEnabled, manualEnabled, surchargeFreeThreshold: parsed });
  };

  const handleThresholdUpdate = () => {
    const parsed = parseFloat(threshold);
    if (!threshold.trim() || isNaN(parsed) || parsed < 0) {
      toast.error('Enter a valid surcharge-free threshold');
      return;
    }
    updateMutation.mutate({ surchargeFreeThreshold: parsed });
  };

  const handleToggle = (field: 'onlineEnabled' | 'manualEnabled', value: boolean) => {
    if (field === 'onlineEnabled') setOnlineEnabled(value);
    if (field === 'manualEnabled') setManualEnabled(value);
    updateMutation.mutate({ [field]: value });
  };

  // Nothing configured yet -- surcharge-free threshold has no default, so
  // this is a required first step rather than something that silently
  // inherits an arbitrary number.
  if (!hasConfig) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" />
            Set Up Payment Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Before you can manage online or manual payments, set your school's surcharge-free
            threshold — the amount below which no online gateway fee is added for parents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Surcharge-Free Threshold
            </Label>
            <Input
              type="number"
              min={0}
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 500"
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">
              Online payments at or below this amount won't include a gateway fee.
            </p>
          </div>
          <Button size="sm" onClick={handleInitialSave} disabled={updateMutation.isPending || !threshold.trim()}>
            {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Save & Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" />
            Payment Methods
          </CardTitle>
          <CardDescription className="text-xs">Enable or disable payment methods for parents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Online Payments</p>
              <p className="text-xs text-muted-foreground">Accept payments via the platform's payment gateway</p>
              {onlineOverridden && (
                <p className="text-xs text-warning flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3" /> Set by platform admin — your toggle won't take effect
                </p>
              )}
            </div>
            <Switch
              checked={onlineEnabled}
              onCheckedChange={(v) => handleToggle('onlineEnabled', v)}
              disabled={updateMutation.isPending}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Manual Payments</p>
              <p className="text-xs text-muted-foreground">Accept UTR/transaction ID submissions</p>
              {manualOverridden && (
                <p className="text-xs text-warning flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3" /> Set by platform admin — your toggle won't take effect
                </p>
              )}
            </div>
            <Switch
              checked={manualEnabled}
              onCheckedChange={(v) => handleToggle('manualEnabled', v)}
              disabled={updateMutation.isPending}
            />
          </div>
          {effective && !effective.onlineEnabled && onlineEnabled && !onlineOverridden && (
            <p className="text-xs text-muted-foreground">
              Online payments are currently disabled platform-wide, so this won't take effect yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Surcharge-Free Threshold</CardTitle>
          <CardDescription className="text-xs">
            Online payments include a gateway fee{effective?.surchargePct ? ` (${effective.surchargePct}%)` : ''} charged
            to the parent above this amount. At or below it, no fee is added.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Threshold Amount (₹)</Label>
            <Input
              type="number"
              min={0}
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-40"
            />
          </div>
          <Button size="sm" onClick={handleThresholdUpdate} disabled={updateMutation.isPending || !threshold.trim()}>
            {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
