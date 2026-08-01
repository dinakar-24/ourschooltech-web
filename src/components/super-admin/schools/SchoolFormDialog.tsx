import { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, X, Palette, Globe, Eye, EyeOff, UserCog, Loader2 } from 'lucide-react';
import { IndianPhoneInput } from '@/components/ui/indian-phone-input';
import { Separator } from '@/components/ui/separator';
import { validatePassword } from '@/lib/password-validation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// School logo upload was silently going nowhere: handleLogoChange only ever
// set a local base64 preview (FileReader.readAsDataURL) — formData.logo,
// the field actually submitted, stayed empty unless editing a school that
// already had one. Reuses the same platform-assets Storage bucket + public-
// URL pattern already established for platform branding (BrandingSettings.tsx)
// — Storage itself is unaffected by the Auth/DB migration, same as every
// other upload in the app.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
function getPublicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/platform-assets/${path}`;
}

interface SchoolFormData {
  name: string;
  code: string;
  subdomain: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo: string;
  primary_color: string;
  accent_color: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

interface School {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  logo: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  created_at: string;
}

interface SchoolFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSchool: School | null;
  onSubmit: (data: SchoolFormData, logoPreview: string | null) => Promise<void>;
  isSubmitting: boolean;
}

const BASE_DOMAIN = 'ourschooltech.com';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const initialFormData: SchoolFormData = {
  name: '',
  code: '',
  subdomain: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  logo: '',
  primary_color: '#0F766E',
  accent_color: '#E69500',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
};

export const SchoolFormDialog = memo(function SchoolFormDialog({
  open,
  onOpenChange,
  editingSchool,
  onSubmit,
  isSubmitting,
}: SchoolFormDialogProps) {
  const [formData, setFormData] = useState<SchoolFormData>(initialFormData);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [autoSubdomain, setAutoSubdomain] = useState(true);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingSchool) {
        setFormData({
          name: editingSchool.name,
          code: editingSchool.code,
          subdomain: editingSchool.subdomain || '',
          address: editingSchool.address,
          city: editingSchool.city,
          phone: editingSchool.phone || '',
          email: editingSchool.email || '',
          logo: editingSchool.logo || '',
          primary_color: editingSchool.primary_color || '#0F766E',
          accent_color: editingSchool.accent_color || '#E69500',
          // Admin account is created once, at school-creation time — nothing
          // to prefill or re-collect here.
          adminFirstName: '',
          adminLastName: '',
          adminEmail: '',
          adminPassword: '',
        });
        setLogoPreview(editingSchool.logo || null);
        setAutoSubdomain(false);
      } else {
        setFormData(initialFormData);
        setLogoPreview(null);
        setAutoSubdomain(true);
      }
    }
  }, [open, editingSchool]);

  const handleLogoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    // Instant local preview while the real upload happens in the background.
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `school-logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('platform-assets')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (error) throw error;

      setFormData(prev => ({ ...prev, logo: getPublicUrl(path) }));
    } catch (err: any) {
      toast.error('Failed to upload logo: ' + err.message);
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
    }
  }, []);

  const removeLogo = useCallback(() => {
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo: '' }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingSchool) {
      const passwordError = validatePassword(formData.adminPassword);
      if (passwordError) {
        alert(passwordError);
        return;
      }
    }

    await onSubmit(formData, logoPreview);
  };

  const handleFieldChange = useCallback((field: keyof SchoolFormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate subdomain from name
      if (field === 'name' && autoSubdomain) {
        updated.subdomain = slugify(value);
      }
      return updated;
    });
  }, [autoSubdomain]);

  const handleSubdomainChange = useCallback((value: string) => {
    setAutoSubdomain(false);
    setFormData(prev => ({ ...prev, subdomain: slugify(value) }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSchool ? 'Edit School' : 'Add New School'}</DialogTitle>
          <DialogDescription>
            {editingSchool ? 'Update school details' : 'Enter the details of the new school'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">School Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Delhi Public School"
                required
              />
            </div>

            {/* Subdomain */}
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="subdomain">Subdomain *</Label>
              </div>
              <div className="flex items-center gap-0">
                <Input
                  id="subdomain"
                  value={formData.subdomain}
                  onChange={(e) => handleSubdomainChange(e.target.value)}
                  placeholder="delhi-public-school"
                  className="rounded-r-none border-r-0"
                  required
                />
                <span className="inline-flex items-center px-3 h-9 rounded-r-md border border-l-0 bg-muted text-xs text-muted-foreground whitespace-nowrap">
                  .{BASE_DOMAIN}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">{formData.subdomain || '...'}.{BASE_DOMAIN}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">School Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleFieldChange('code', e.target.value.toUpperCase())}
                  placeholder="DPS001"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  placeholder="New Delhi"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder="123, Main Road"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <IndianPhoneInput
                  id="phone"
                  value={formData.phone}
                  onChange={(v) => handleFieldChange('phone', v)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  placeholder="school@example.com"
                />
              </div>
            </div>

            {/* Administrator Account — created atomically with the school,
                so this only applies when adding a new one. */}
            {!editingSchool && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Administrator Account</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="adminFirstName">First Name *</Label>
                      <Input
                        id="adminFirstName"
                        value={formData.adminFirstName}
                        onChange={(e) => handleFieldChange('adminFirstName', e.target.value)}
                        placeholder="Jane"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="adminLastName">Last Name *</Label>
                      <Input
                        id="adminLastName"
                        value={formData.adminLastName}
                        onChange={(e) => handleFieldChange('adminLastName', e.target.value)}
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="adminEmail">Admin Email *</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => handleFieldChange('adminEmail', e.target.value)}
                      placeholder="admin@school.com"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="adminPassword">Admin Password *</Label>
                    <div className="relative">
                      <Input
                        id="adminPassword"
                        type={showAdminPassword ? 'text' : 'password'}
                        value={formData.adminPassword}
                        onChange={(e) => handleFieldChange('adminPassword', e.target.value)}
                        placeholder="Enter a strong password"
                        className="pr-10"
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Min 8 chars · uppercase · lowercase · number · special character
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Theme Colors */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">School Theme Colors</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                      className="w-9 h-9 rounded-md border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                      className="flex-1 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Accent Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={formData.accent_color}
                      onChange={(e) => handleFieldChange('accent_color', e.target.value)}
                      className="w-9 h-9 rounded-md border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                    />
                    <Input
                      value={formData.accent_color}
                      onChange={(e) => handleFieldChange('accent_color', e.target.value)}
                      className="flex-1 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button type="button" className="px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: formData.primary_color }}>Primary</button>
                <button type="button" className="px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: formData.accent_color }}>Accent</button>
              </div>
            </div>
            <Separator />

            {/* Logo Upload */}
            <div className="grid gap-2">
              <Label>School Logo (Optional)</Label>
              {logoPreview ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted">
                    <img 
                      src={logoPreview} 
                      alt="School logo preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeLogo}
                    disabled={uploadingLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                  {uploadingLogo && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingLogo}
                    onClick={() => document.getElementById('logo')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                  <span className="text-sm text-muted-foreground">PNG, JPG up to 2MB</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || uploadingLogo}>
              {isSubmitting ? 'Saving...' : editingSchool ? 'Update School' : 'Add School'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});
