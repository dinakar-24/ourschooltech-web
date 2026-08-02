import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { IndianPhoneInput } from '@/components/ui/indian-phone-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Palette, Globe, ImageIcon, Loader2, Upload, Trash2 } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { uploadToR2 } from '@/lib/uploads';

import { toast } from 'sonner';

const BRANDING_FALLBACK = {
  platform_name: 'Our School Tech',
  domain: 'ourschooltech.in',
  support_email: 'support@ourschooltech.in',
  support_phone: '',
  tagline: 'Smart School Management for Modern Education',
  footer_text: '© 2025 Our School Tech. All rights reserved.',
  logo_url: '',
  favicon_url: '',
};

interface FileUploadZoneProps {
  label: string;
  hint: string;
  currentUrl: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  uploading: boolean;
  accept: string;
}

function FileUploadZone({ label, hint, currentUrl, onUpload, onRemove, uploading, accept }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be under 2MB');
      return;
    }
    onUpload(file);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {currentUrl ? (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-center bg-muted/50 rounded-md p-4 min-h-[80px]">
            <img src={currentUrl} alt={label} className="max-h-16 max-w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Replace
            </Button>
            <Button size="sm" variant="outline" onClick={onRemove} disabled={uploading}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary'); }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); handleFile(e.dataTransfer.files[0]); }}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
          ) : (
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          )}
          <p className="text-sm text-muted-foreground">
            {uploading ? 'Uploading...' : 'Drop file here or click to upload'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

export function BrandingSettings() {
  const { getSetting, updateSetting, isLoading } = useSystemSettings();

  const [branding, setBranding] = useState(BRANDING_FALLBACK);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setBranding(getSetting('branding', BRANDING_FALLBACK));
    }
  }, [isLoading]);

  const saving = updateSetting.isPending;

  const uploadFile = async (file: File, path: string) => {
    const ext = file.name.split('.').pop();
    const key = `platform-assets/${path}.${ext}`;

    const { url } = await uploadToR2(key, file, file.type);
    return url || '';
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, 'logo');
      const updated = { ...branding, logo_url: url + '?t=' + Date.now() };
      setBranding(updated);
      updateSetting.mutate({ key: 'branding', value: updated });
      toast.success('Logo uploaded successfully');
    } catch (err: any) {
      toast.error('Failed to upload logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (file: File) => {
    setUploadingFavicon(true);
    try {
      const url = await uploadFile(file, 'favicon');
      const updated = { ...branding, favicon_url: url + '?t=' + Date.now() };
      setBranding(updated);
      updateSetting.mutate({ key: 'branding', value: updated });
      toast.success('Favicon uploaded successfully');
    } catch (err: any) {
      toast.error('Failed to upload favicon: ' + err.message);
    } finally {
      setUploadingFavicon(false);
    }
  };

  const removeLogo = () => {
    const updated = { ...branding, logo_url: '' };
    setBranding(updated);
    updateSetting.mutate({ key: 'branding', value: updated });
  };

  const removeFavicon = () => {
    const updated = { ...branding, favicon_url: '' };
    setBranding(updated);
    updateSetting.mutate({ key: 'branding', value: updated });
  };

  return (
    <div className="space-y-6">
      {/* Platform Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Platform Identity
          </CardTitle>
          <CardDescription>Configure the platform name, domain, and public-facing identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input value={branding.platform_name} onChange={(e) => setBranding(s => ({ ...s, platform_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input value={branding.domain} onChange={(e) => setBranding(s => ({ ...s, domain: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input type="email" value={branding.support_email} onChange={(e) => setBranding(s => ({ ...s, support_email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Support Phone</Label>
              <IndianPhoneInput value={branding.support_phone} onChange={(v) => setBranding(s => ({ ...s, support_phone: v }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input
              value={branding.tagline || ''}
              onChange={(e) => setBranding(s => ({ ...s, tagline: e.target.value }))}
              placeholder="A short description of your platform"
            />
          </div>
          <div className="space-y-2">
            <Label>Footer Text</Label>
            <Textarea
              value={branding.footer_text || ''}
              onChange={(e) => setBranding(s => ({ ...s, footer_text: e.target.value }))}
              placeholder="© 2025 Your Company. All rights reserved."
              rows={2}
            />
          </div>
          <Button disabled={saving} onClick={() => updateSetting.mutate({ key: 'branding', value: branding })}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Identity
          </Button>
        </CardContent>
      </Card>

      {/* Theme Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Theme & Colors
          </CardTitle>
          <CardDescription>
            Theme colors are now configured per school. Go to <strong>Schools → Edit School</strong> to set each school's primary and accent colors.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Logo & Favicon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Logo & Favicon
          </CardTitle>
          <CardDescription>Upload platform branding assets used across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <FileUploadZone
              label="Platform Logo"
              hint="PNG, JPG, SVG • Max 2MB • Recommended: 200×60px"
              currentUrl={branding.logo_url}
              onUpload={handleLogoUpload}
              onRemove={removeLogo}
              uploading={uploadingLogo}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
            />
            <FileUploadZone
              label="Favicon"
              hint="PNG, ICO • Max 2MB • Recommended: 32×32px or 64×64px"
              currentUrl={branding.favicon_url}
              onUpload={handleFaviconUpload}
              onRemove={removeFavicon}
              uploading={uploadingFavicon}
              accept="image/png,image/x-icon,image/vnd.microsoft.icon"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
