import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, IndianRupee, Wifi, WifiOff, RotateCcw } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useAllSchoolPaymentConfigs, useSetPaymentOverride } from '@/hooks/usePaymentConfig';
import { toast } from 'sonner';

// Cycles null (no override) -> false (forced off) -> true (forced on) -> null.
function nextOverrideValue(current: boolean | null | undefined): boolean | null {
  if (current === null || current === undefined) return false;
  if (current === false) return true;
  return null;
}

function overrideLabel(value: boolean | null | undefined) {
  if (value === null || value === undefined) return 'No Override';
  return value ? 'Forced On' : 'Forced Off';
}

export function PaymentSettings() {
  const { getSetting, updateSetting } = useSystemSettings();
  const overrideMutation = useSetPaymentOverride();

  const paymentConfig = getSetting('payment_config', {
    online_enabled: true,
    manual_enabled: true,
    extra_charge_pct: 2.0,
  });

  const [onlineEnabled, setOnlineEnabled] = useState(paymentConfig.online_enabled);
  const [manualEnabled, setManualEnabled] = useState(paymentConfig.manual_enabled);
  const [extraCharge, setExtraCharge] = useState(String(paymentConfig.extra_charge_pct));

  const { data: schoolConfigs = [], isLoading } = useAllSchoolPaymentConfigs();

  const handleSaveGlobal = () => {
    const pct = parseFloat(extraCharge);
    if (isNaN(pct) || pct < 0 || pct > 10) {
      toast.error('Extra charge must be between 0% and 10%');
      return;
    }
    updateSetting.mutate({
      key: 'payment_config',
      value: { online_enabled: onlineEnabled, manual_enabled: manualEnabled, extra_charge_pct: pct },
    });
  };

  const cycleOverride = (schoolId: string, field: 'online' | 'manual', current: boolean | null | undefined) => {
    overrideMutation.mutate({ schoolId, field, value: nextOverrideValue(current) });
  };

  return (
    <div className="space-y-5">
      {/* Global Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" />
            Global Payment Settings
          </CardTitle>
          <CardDescription className="text-xs">Control payment methods across all schools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Online Payments</p>
              <p className="text-xs text-muted-foreground">Enable the online payment gateway for schools</p>
            </div>
            <Switch checked={onlineEnabled} onCheckedChange={setOnlineEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Manual Payments</p>
              <p className="text-xs text-muted-foreground">Allow UTR/transaction ID submissions</p>
            </div>
            <Switch checked={manualEnabled} onCheckedChange={setManualEnabled} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Gateway Fee % (Online)
            </Label>
            <Input type="number" value={extraCharge} onChange={(e) => setExtraCharge(e.target.value)} min={0} max={10} step={0.1} className="w-32" />
            <p className="text-xs text-muted-foreground">
              Charged to parents above each school's own surcharge-free threshold (0-10%).
            </p>
          </div>
          <Button size="sm" onClick={handleSaveGlobal} disabled={updateSetting.isPending}>
            {updateSetting.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Save Global Settings
          </Button>
        </CardContent>
      </Card>

      {/* Per-School Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">School Payment Status</CardTitle>
          <CardDescription className="text-xs">
            Each school's own posture, and what's actually in effect. Override forces a value
            regardless of what the school sets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : schoolConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No schools found</p>
          ) : (
            <div className="space-y-3">
              {schoolConfigs.map(s => (
                <div key={s.schoolId} className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.schoolName}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.schoolCode}
                        {s.config ? ` • Threshold ₹${s.config.surchargeFreeThreshold}` : ' • Not configured yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={s.effective.onlineEnabled ? 'default' : 'secondary'} className="text-[10px] gap-1">
                        {s.effective.onlineEnabled ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        Online {s.effective.onlineEnabled ? 'On' : 'Off'}
                      </Badge>
                      <Badge variant={s.effective.manualEnabled ? 'default' : 'secondary'} className="text-[10px]">
                        Manual {s.effective.manualEnabled ? 'On' : 'Off'}
                      </Badge>
                    </div>
                  </div>

                  {s.config && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => cycleOverride(s.schoolId, 'online', s.config?.superAdminOverrideOnline)}
                        disabled={overrideMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3" /> Online: {overrideLabel(s.config.superAdminOverrideOnline)}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => cycleOverride(s.schoolId, 'manual', s.config?.superAdminOverrideManual)}
                        disabled={overrideMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3" /> Manual: {overrideLabel(s.config.superAdminOverrideManual)}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
