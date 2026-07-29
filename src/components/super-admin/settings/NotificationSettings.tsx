import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, MessageSquare, Loader2, Key, Eye, EyeOff, ShieldCheck, Save } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const NOTIF_FALLBACK = { subscription_expiry_alerts: true, new_school_registration: true, payment_failure_alerts: true, maintenance_notices: false };
const EMAIL_FALLBACK = { smtp_server: '', port: '587', sender_email: 'noreply@ourschooltech.com', sender_name: 'OurSchool Tech' };
const SMS_FALLBACK = { enabled: false, provider: '', api_key_configured: false };
const API_FALLBACK = { razorpay_key_id: '', razorpay_key_secret: '' };

export function NotificationSettings() {
  const { getSetting, updateSetting, isLoading } = useSystemSettings();

  const [notif, setNotif] = useState(NOTIF_FALLBACK);
  const [email, setEmail] = useState(EMAIL_FALLBACK);
  const [sms, setSms] = useState(SMS_FALLBACK);
  const [api, setApi] = useState(API_FALLBACK);

  // Password dialog state
  const [pendingSave, setPendingSave] = useState<{ key: string; value: Record<string, any>; label: string } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setNotif(getSetting('notifications', NOTIF_FALLBACK));
      setEmail(getSetting('email_config', EMAIL_FALLBACK));
      setSms(getSetting('sms_config', SMS_FALLBACK));
      setApi(getSetting('api_integrations', API_FALLBACK));
    }
  }, [isLoading]);

  const saving = updateSetting.isPending;

  const requestSave = useCallback((key: string, value: Record<string, any>, label: string) => {
    setPendingSave({ key, value, label });
    setPassword('');
    setShowPassword(false);
  }, []);

  const confirmSave = useCallback(async () => {
    if (!pendingSave || !password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('Unable to verify identity');
        return;
      }

      // ⚠️ Gate deliberately NOT migrated yet. POST /auth/verify-password
      // exists, but the save it guards writes through useSystemSettings, which
      // has no Express equivalent (there is no SystemSetting Prisma model).
      // Fixing only the gate would move the failure one step later instead of
      // resolving it. Migrate both together.
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) {
        toast.error('Incorrect password. Please try again.');
        return;
      }

      // Password verified, save the setting
      updateSetting.mutate({ key: pendingSave.key, value: pendingSave.value });
      setPendingSave(null);
      setPassword('');
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [pendingSave, password, updateSetting]);

  const handleClose = useCallback(() => {
    setPendingSave(null);
    setPassword('');
    setShowPassword(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* System Notifications */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            System Notifications
          </CardTitle>
          <CardDescription>Configure global notification preferences for the platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { key: 'subscription_expiry_alerts' as const, label: 'Subscription expiry alerts', desc: 'Notify admins before their subscription expires' },
            { key: 'new_school_registration' as const, label: 'New school registration', desc: 'Get notified when a new school registers' },
            { key: 'payment_failure_alerts' as const, label: 'Payment failure alerts', desc: 'Alert when a subscription payment fails' },
            { key: 'maintenance_notices' as const, label: 'System maintenance notices', desc: 'Auto-notify all schools before maintenance' },
          ]).map((item, i) => (
            <div key={item.key}>
              {i > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={notif[item.key]} onCheckedChange={(v) => setNotif(s => ({ ...s, [item.key]: v }))} />
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={() => requestSave('notifications', notif, 'Notification Preferences')}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Notifications
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            Email Configuration
          </CardTitle>
          <CardDescription>SMTP settings for outgoing platform emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SMTP Server</Label>
              <Input value={email.smtp_server} onChange={(e) => setEmail(s => ({ ...s, smtp_server: e.target.value }))} placeholder="smtp.hostinger.com" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Port</Label>
              <Input value={email.port} onChange={(e) => setEmail(s => ({ ...s, port: e.target.value }))} placeholder="587" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sender Email</Label>
              <Input type="email" value={email.sender_email} onChange={(e) => setEmail(s => ({ ...s, sender_email: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sender Name</Label>
              <Input value={email.sender_name} onChange={(e) => setEmail(s => ({ ...s, sender_name: e.target.value }))} className="h-9" />
            </div>
          </div>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => requestSave('email_config', email, 'Email Configuration')}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Email Settings
          </Button>
        </CardContent>
      </Card>

      {/* SMS Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            SMS Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enable SMS notifications</p>
              <p className="text-xs text-muted-foreground">Send SMS alerts to parents and admins</p>
            </div>
            <Switch checked={sms.enabled} onCheckedChange={(v) => setSms(s => ({ ...s, enabled: v }))} />
          </div>
          <Separator />
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SMS Provider</Label>
              <Input value={sms.provider} onChange={(e) => setSms(s => ({ ...s, provider: e.target.value }))} placeholder="e.g. Twilio, MSG91" disabled={!sms.enabled} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API Key Status</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/50 text-sm">
                {sms.api_key_configured ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">✓ Configured</span>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">SMS API keys are managed as server-side secrets for security.</p>
            </div>
          </div>
          <Button
            size="sm"
            disabled={saving || !sms.enabled}
            onClick={() => requestSave('sms_config', sms, 'SMS Configuration')}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save SMS Settings
          </Button>
        </CardContent>
      </Card>

      {/* API & Integrations */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-primary" />
            </div>
            API & Integrations
          </CardTitle>
          <CardDescription>Manage external service keys and integrations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Razorpay Key ID</Label>
              <Input type="password" value={api.razorpay_key_id} onChange={(e) => setApi(s => ({ ...s, razorpay_key_id: e.target.value }))} placeholder="••••••••" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Razorpay Key Secret</Label>
              <Input type="password" value={api.razorpay_key_secret} onChange={(e) => setApi(s => ({ ...s, razorpay_key_secret: e.target.value }))} placeholder="••••••••" className="h-9" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Payment keys are managed via environment secrets for security. Contact the developer to update.</p>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => requestSave('api_integrations', api, 'API & Integrations')}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save API Settings
          </Button>
        </CardContent>
      </Card>

      {/* Password Verification Dialog */}
      <AlertDialog open={!!pendingSave} onOpenChange={(open) => !open && handleClose()}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <AlertDialogTitle className="text-center">Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Enter your Super Admin password to save <span className="font-medium text-foreground">{pendingSave?.label}</span> changes.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="settings-password" className="text-xs">Password</Label>
            <div className="relative">
              <Input
                id="settings-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
                autoFocus
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

          <AlertDialogFooter>
            <Button variant="outline" size="sm" onClick={handleClose} disabled={verifying}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmSave}
              disabled={verifying || !password.trim()}
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
