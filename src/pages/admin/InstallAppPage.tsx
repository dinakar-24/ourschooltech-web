import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useTenant } from '@/contexts/TenantContext';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Smartphone, CheckCircle2, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { useState } from 'react';

const BASE_DOMAIN = 'ourschooltech.com';

export default function InstallAppPage() {
  const { school } = useAuth();
  const { impersonatedSchool, isImpersonating } = useImpersonation();
  const { tenant, isSubdomain } = useTenant();
  const { isInstalled, promptInstall } = useInstallPrompt();
  const schoolId = useEffectiveSchoolId();
  const [installing, setInstalling] = useState(false);

  const displaySchool = isImpersonating ? impersonatedSchool : school;

  const { data: schoolSubdomain } = useQuery({
    queryKey: ['school-subdomain', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('subdomain').eq('id', schoolId!).single();
      return data?.subdomain || null;
    },
    enabled: !!schoolId && !isSubdomain,
    staleTime: Infinity,
  });

  const portalUrl = isSubdomain && tenant
    ? `https://${tenant.subdomain}.${BASE_DOMAIN}`
    : schoolSubdomain
      ? `https://${schoolSubdomain}.${BASE_DOMAIN}`
      : window.location.origin;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        toast.success('App installed successfully!');
      }
    } catch {
      toast.error('Installation not available. Please use Chrome or Edge browser on the school portal URL.');
    } finally {
      setInstalling(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    toast.success('Link copied to clipboard');
  };

  const schoolName = displaySchool?.name || tenant?.name || 'School';
  const schoolLogo = displaySchool?.logo || tenant?.logo;

  return (
      <div className="max-w-lg mx-auto space-y-6 pb-8">
        <div className="text-center space-y-3 pt-2">
          {schoolLogo && (
            <div className="w-20 h-20 mx-auto flex items-center justify-center overflow-hidden shrink-0">
              <img src={schoolLogo} alt={schoolName} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-foreground">{schoolName}</h2>
            <p className="text-sm text-muted-foreground mt-1">Install as a mobile app</p>
          </div>
        </div>

        {isInstalled ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              App is already installed on this device!
            </p>
          </div>
        ) : (
          <Button
            onClick={handleInstall}
            disabled={installing}
            className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            size="lg"
          >
            {installing ? (
              <>
                <Smartphone className="w-5 h-5 animate-pulse" />
                Installing...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Install App
              </>
            )}
          </Button>
        )}

        <div className="rounded-xl border border-border bg-card p-5 text-center space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Share with Teachers & Parents</h3>
          <p className="text-xs text-muted-foreground">Scan this QR code from any phone to open the school portal</p>
          <div className="inline-block p-3 bg-white rounded-xl">
            <QRCodeSVG
              value={portalUrl}
              size={180}
              level="H"
              imageSettings={schoolLogo ? {
                src: schoolLogo,
                height: 36,
                width: 36,
                excavate: true,
              } : undefined}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="w-full">
            Copy Portal Link
          </Button>
        </div>
      </div>
  );
}