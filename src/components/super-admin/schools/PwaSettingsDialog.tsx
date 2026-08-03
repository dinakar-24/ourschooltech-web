import { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Upload, X, Smartphone, Palette, Image, Type } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PwaSettingsData {
  app_display_name: string;
  app_short_name: string;
  primary_color: string;
  accent_color: string;
  secondary_color: string;
  background_color: string;
  logo: string | null;
  splash_screen_image_url: string | null;
}

interface SchoolForPwa {
  id: string;
  name: string;
  code: string;
  logo: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  secondary_color?: string | null;
  background_color?: string | null;
  app_display_name?: string | null;
  app_short_name?: string | null;
  splash_screen_image_url?: string | null;
}

interface PwaSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: SchoolForPwa | null;
}

export const PwaSettingsDialog = memo(function PwaSettingsDialog({
  open,
  onOpenChange,
  school,
}: PwaSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<PwaSettingsData>({
    app_display_name: '',
    app_short_name: '',
    primary_color: '#0F766E',
    accent_color: '#E69500',
    secondary_color: '#1a1a2e',
    background_color: '#ffffff',
    logo: null,
    splash_screen_image_url: null,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [splashPreview, setSplashPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && school) {
      setData({
        app_display_name: school.app_display_name || school.name,
        app_short_name: school.app_short_name || school.name.slice(0, 12),
        primary_color: school.primary_color || '#0F766E',
        accent_color: school.accent_color || '#E69500',
        secondary_color: school.secondary_color || '#1a1a2e',
        background_color: school.background_color || '#ffffff',
        logo: school.logo || null,
        splash_screen_image_url: school.splash_screen_image_url || null,
      });
      setLogoPreview(school.logo || null);
      setSplashPreview(school.splash_screen_image_url || null);
    }
  }, [open, school]);

  const handleFileUpload = useCallback((field: 'logo' | 'splash_screen_image_url') => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File must be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (field === 'logo') {
          setLogoPreview(result);
        } else {
          setSplashPreview(result);
        }
      };
      reader.readAsDataURL(file);
    };
  }, []);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        appDisplayName: data.app_display_name || null,
        appShortName: data.app_short_name || null,
        primaryColor: data.primary_color,
        accentColor: data.accent_color,
        secondaryColor: data.secondary_color,
        backgroundColor: data.background_color,
      };

      // Handle logo
      if (logoPreview && logoPreview !== school.logo) {
        updateData.logo = logoPreview;
      } else if (!logoPreview) {
        updateData.logo = null;
      }

      // Handle splash
      if (splashPreview && splashPreview !== school.splash_screen_image_url) {
        updateData.splashScreenImageUrl = splashPreview;
      } else if (!splashPreview) {
        updateData.splashScreenImageUrl = null;
      }

      await api.put(`/superadmin/schools/${school.id}`, updateData);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      toast.success('PWA settings saved! Changes will reflect on next app load.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const displayName = data.app_display_name || school?.name || 'School';
  const shortName = data.app_short_name || displayName.slice(0, 12);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            PWA Settings — {school?.name}
          </DialogTitle>
          <DialogDescription>
            Customize how the app appears when installed on phones and tablets
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr,200px]">
          {/* Form */}
          <div className="space-y-5">
            {/* App Identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">App Identity</Label>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Display Name (shown on splash)</Label>
                  <Input
                    value={data.app_display_name}
                    onChange={(e) => setData(p => ({ ...p, app_display_name: e.target.value }))}
                    placeholder="My School App"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Short Name (shown under icon, max 12 chars)</Label>
                  <Input
                    value={data.app_short_name}
                    onChange={(e) => setData(p => ({ ...p, app_short_name: e.target.value.slice(0, 12) }))}
                    placeholder="MySchool"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* App Icon (Logo) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">App Icon</Label>
              </div>
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl border overflow-hidden bg-white flex items-center justify-center">
                    <img src={logoPreview} alt="App icon" className="w-12 h-12 object-contain" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLogoPreview(null)} className="text-destructive">
                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <>
                  <input id="pwa-logo" type="file" accept="image/*" className="hidden" onChange={handleFileUpload('logo')} />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('pwa-logo')?.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Icon
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* Splash Screen */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Splash Screen Image</Label>
              </div>
              <p className="text-xs text-muted-foreground">Shown when the app launches in standalone mode</p>
              {splashPreview ? (
                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 rounded-lg border overflow-hidden bg-muted">
                    <img src={splashPreview} alt="Splash" className="w-full h-full object-cover" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSplashPreview(null)} className="text-destructive">
                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <>
                  <input id="pwa-splash" type="file" accept="image/*" className="hidden" onChange={handleFileUpload('splash_screen_image_url')} />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('pwa-splash')?.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Splash
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* Theme Colors */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Theme Colors</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['primary_color', 'Primary'],
                  ['accent_color', 'Accent'],
                  ['secondary_color', 'Secondary'],
                  ['background_color', 'Background'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={data[key]}
                        onChange={(e) => setData(p => ({ ...p, [key]: e.target.value }))}
                        className="w-8 h-8 rounded-md border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                      />
                      <Input
                        value={data[key]}
                        onChange={(e) => setData(p => ({ ...p, [key]: e.target.value }))}
                        className="flex-1 font-mono text-xs h-8"
                        maxLength={7}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="hidden md:flex flex-col items-center gap-3">
            <Label className="text-xs text-muted-foreground font-semibold">Live Preview</Label>

            {/* Phone mockup */}
            <div
              className="w-[180px] h-[320px] rounded-[24px] border-2 border-border overflow-hidden shadow-lg flex flex-col items-center justify-center relative bg-white"
              style={{ backgroundColor: data.background_color }}
            >
              {/* Status bar */}
              <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center" style={{ backgroundColor: data.primary_color }}>
                <div className="w-12 h-1.5 rounded-full bg-white/30" />
              </div>

              {/* Splash content */}
              <div className="flex flex-col items-center gap-3 px-4">
                {logoPreview ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-sm border border-border">
                    <img src={logoPreview} alt="" className="w-14 h-14 object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: data.primary_color }}>
                    <span className="text-white text-2xl font-bold">{displayName.charAt(0)}</span>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-[11px] font-bold leading-tight text-foreground">
                    {displayName}
                  </p>
                  <p className="text-[9px] mt-0.5 text-muted-foreground">
                    Loading...
                  </p>
                </div>
                {/* Loading bar */}
                <div className="w-20 h-1.5 rounded-full overflow-hidden bg-muted">
                  <div className="w-3/5 h-full rounded-full" style={{ backgroundColor: data.primary_color }} />
                </div>
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Icon preview */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border flex items-center justify-center shadow-sm">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="w-10 h-10 object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: data.primary_color }}>
                    <span className="text-white text-lg font-bold">{displayName.charAt(0)}</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground font-medium text-center leading-tight max-w-[60px] truncate">
                {shortName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save PWA Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
