import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Loader2,
  Pencil,
  Check,
  X,
  MapPin,
  Building,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
];

export default function AdminProfilePage() {
  const { user, school, logout } = useAuth();
  const { impersonatedSchool, isImpersonating } = useImpersonation();
  const schoolId = useEffectiveSchoolId();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();

  const displaySchool = isImpersonating ? impersonatedSchool : school;

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [editingSchool, setEditingSchool] = useState(false);
  const [schoolName, setSchoolName] = useState(displaySchool?.name || '');
  const [schoolAddress, setSchoolAddress] = useState((school as any)?.address || '');
  const [schoolCity, setSchoolCity] = useState((school as any)?.city || '');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [savingSchool, setSavingSchool] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ['admin-profile', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ admin: { firstName: string; lastName: string; phone: string | null; photo: string | null; createdAt: string; user: { email: string } } }>('/school/profile');
      const a = data.admin;
      return {
        full_name: `${a.firstName} ${a.lastName}`.trim(),
        phone: a.phone,
        photo: a.photo,
        email: a.user.email,
        created_at: a.createdAt,
      };
    },
    enabled: !!user?.id,
  });

  const { data: schoolData } = useQuery({
    queryKey: ['school-details', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ school: { name: string; address: string | null; city: string | null; email: string | null; phone: string | null; schoolCode: string } }>('/school/info');
      return { ...data.school, code: data.school.schoolCode, logo: null as string | null };
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    if (profileData) {
      setProfileName(profileData.full_name || '');
      setProfilePhone(profileData.phone || '');
    }
  }, [profileData]);

  useEffect(() => {
    if (schoolData) {
      setSchoolName(schoolData.name || '');
      setSchoolAddress(schoolData.address || '');
      setSchoolCity(schoolData.city || '');
      setSchoolEmail(schoolData.email || '');
      setSchoolPhone(schoolData.phone || '');
    }
  }, [schoolData]);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { toast.error('Name is required'); return; }
    setSavingProfile(true);
    try {
      const [firstName, ...rest] = profileName.trim().split(' ');
      await api.patch('/school/profile', {
        firstName,
        lastName: rest.join(' ') || firstName,
        phone: profilePhone.trim() || null,
      });
      toast.success('Profile updated');
      setEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSchool = async () => {
    if (!schoolId) return;
    setSavingSchool(true);
    try {
      await api.patch('/school/info', {
        name: schoolName.trim(),
        address: schoolAddress.trim(),
        city: schoolCity.trim(),
        phone: schoolPhone.trim() || null,
      });
      toast.success('School info updated');
      setEditingSchool(false);
      queryClient.invalidateQueries({ queryKey: ['school-details'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update school info');
    } finally {
      setSavingSchool(false);
    }
  };

  const handleLanguageChange = (val: string) => {
    i18n.changeLanguage(val);
    localStorage.setItem('app-language', val);
    const langLabel = LANGUAGES.find(l => l.code === val)?.label || val;
    toast.success(`Language changed to ${langLabel}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = profileData?.full_name || user?.name || 'Admin';

  return (
      <div className="max-w-2xl mx-auto space-y-4 pb-8">

        {/* Profile Hero */}
        <Card className="overflow-hidden border-border/60">
          <div className="h-28 sm:h-32 bg-gradient-to-br from-primary via-primary/70 to-accent relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent_60%)]" />
          </div>
          <CardContent className="relative px-4 sm:px-6 pb-5 pt-0">
            {/* Avatar */}
            <div className="flex justify-center -mt-14 sm:-mt-16 mb-2">
              <div className="ring-4 ring-background rounded-full shadow-lg">
                <AvatarUpload
                  value={user?.avatar}
                  onChange={async (url) => {
                    if (user?.id) {
                      await api.patch('/school/profile', { photo: url });
                      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
                    }
                  }}
                  fallback={displayName}
                  size="lg"
                  folder="admins"
                />
              </div>
            </div>

            {/* Name & Role - Centered */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{displayName}</h2>
                {!editingProfile && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingProfile(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
              <Badge className="mt-2 bg-primary/10 text-primary hover:bg-primary/15 border-0 text-xs">
                <Shield className="w-3 h-3 mr-1" />
                School Admin
              </Badge>
            </div>

            {/* Edit Profile Form */}
            {editingProfile ? (
              <div className="border-t border-border pt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
                    <Input value={profileName} onChange={e => setProfileName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Phone Number</Label>
                    <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingProfile(false); setProfileName(profileData?.full_name || ''); setProfilePhone(profileData?.phone || ''); }}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Info Cards */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <InfoRow icon={Mail} label="EMAIL" value={user?.email || '—'} />
                <InfoRow icon={Phone} label="PHONE" value={profileData?.phone || '—'} />
                <InfoRow icon={Building} label="SCHOOL" value={displaySchool?.name || '—'} />
                <InfoRow icon={Calendar} label="MEMBER SINCE" value={profileData?.created_at ? format(new Date(profileData.created_at), 'MMM yyyy') : '—'} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* School Info */}
        <Card className="border-border/60">
          <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Building className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">School Information</h3>
                {schoolData?.code && (
                  <p className="text-[11px] text-muted-foreground">Code: <span className="font-mono font-medium text-foreground">{schoolData.code}</span></p>
                )}
              </div>
            </div>
            {!editingSchool && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" onClick={() => setEditingSchool(true)}>
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            )}
          </div>
          <CardContent className="px-4 sm:px-5 py-3.5">
            {editingSchool ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">School Name</Label>
                    <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    <Input value={schoolCity} onChange={e => setSchoolCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                    <Input value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                    <Input value={schoolEmail} disabled className="opacity-60 cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                    <Input value={schoolPhone} onChange={e => setSchoolPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveSchool} disabled={savingSchool}>
                    {savingSchool ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingSchool(false)}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { icon: Building, label: schoolData?.name || displaySchool?.name || '—' },
                  { icon: MapPin, label: `${schoolData?.address || '—'}, ${schoolData?.city || '—'}` },
                  { icon: Mail, label: schoolData?.email, show: !!schoolData?.email },
                  { icon: Phone, label: schoolData?.phone, show: !!schoolData?.phone },
                ].filter(item => item.show !== false).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-1">
                    <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferences & Quick Links */}
        <Card className="border-border/60 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
            </div>
          </div>

          {/* Language */}
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-border/30">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground text-sm">Language</p>
                <p className="text-xs text-muted-foreground">Interface language</p>
              </div>
            </div>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Navigation Links */}
          {[
            { label: 'Notification Settings', icon: Bell, href: '/admin/settings', desc: 'Manage alerts & reminders' },
            { label: 'Subscription', icon: CreditCard, href: '/admin/subscription', desc: 'Plan & billing details' },
            { label: 'School Settings', icon: Settings, href: '/admin/settings', desc: 'Configure school preferences' },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-muted/50 transition-colors ${i < arr.length - 1 ? 'border-b border-border/30' : ''}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div className="text-left">
                  <span className="font-medium text-foreground text-sm block">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
  );
}

/* Reusable info row for profile details */
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
