import { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { KeyRound, Mail, Timer, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type OnboardingMode = 'SET_PASSWORD' | 'TEMP_PASSWORD';

interface SchoolForOnboarding {
  id: string;
  name: string;
}

interface OnboardingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: SchoolForOnboarding | null;
}

// Super-Admin-only per-school config (Part D, Pass B) -- reachable only
// via SchoolsPage.tsx (a /super-admin/* route), and the PUT this saves to
// (/superadmin/schools/:id) is gated authenticate + authorize('SUPER_ADMIN')
// at the router level. There's no equivalent under the tenant-scoped
// school router, so a School Admin has no path to this setting at all.
export const OnboardingSettingsDialog = memo(function OnboardingSettingsDialog({
  open,
  onOpenChange,
  school,
}: OnboardingSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<OnboardingMode>('SET_PASSWORD');
  const [forceChange, setForceChange] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && school) {
      setLoading(true);
      api.get(`/superadmin/schools/${school.id}`)
        .then(({ data }) => {
          setMode(data.school.onboardingMode || 'SET_PASSWORD');
          setForceChange(data.school.forceChangeOnFirstLogin ?? true);
        })
        .catch(() => toast.error('Failed to load onboarding settings'))
        .finally(() => setLoading(false));
    }
  }, [open, school]);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    try {
      await api.put(`/superadmin/schools/${school.id}`, {
        onboardingMode: mode,
        forceChangeOnFirstLogin: forceChange,
      });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      toast.success('Onboarding settings saved');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Onboarding — {school?.name}
          </DialogTitle>
          <DialogDescription>
            How new accounts created by admins at this school get their first password.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              {([
                {
                  value: 'SET_PASSWORD' as const,
                  icon: Mail,
                  title: 'Set-Password link (recommended)',
                  description: 'New accounts get a welcome email with a link to choose their own password. No password is ever shown to an admin.',
                },
                {
                  value: 'TEMP_PASSWORD' as const,
                  icon: Timer,
                  title: 'Temporary password',
                  description: 'New accounts get a real, random password shown to the admin once, to hand over directly. No welcome email is sent.',
                },
              ]).map((option) => {
                const Icon = option.icon;
                const isSelected = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    )}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Icon className="w-3.5 h-3.5" /> {option.title}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {mode === 'TEMP_PASSWORD' && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Force change on first login</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Block every other page until a real password is set.</p>
                </div>
                <Switch checked={forceChange} onCheckedChange={setForceChange} />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
