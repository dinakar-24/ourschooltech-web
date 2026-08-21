import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  School,
  Loader2,
  Globe,
  CreditCard,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PaymentConfigSection } from '@/components/admin/PaymentConfigSection';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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

export default function SettingsPage() {
  const { school } = useAuth();
  const { t, i18n } = useTranslation();
  // School Admin was the only role without this. The bell dropdown
  // (NotificationCenter) offers `subscribe` but never `unsubscribe`, and the
  // unsubscribe control lived only on the Parent/Teacher/Student settings
  // pages -- so an admin who enabled push had no way anywhere in their
  // portal to turn it back off.
  const { isSubscribed, isSupported, subscribe, unsubscribe, permission } = usePushNotifications();
  const schoolId = useEffectiveSchoolId();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('school');

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      if (!isSupported) {
        toast.error(t('settingsPage.notificationsNotSupported'));
        return;
      }
      const success = await subscribe();
      if (success) {
        toast.success(t('settingsPage.notificationsEnabled'));
      } else if (permission === 'denied') {
        toast.error(t('settingsPage.notificationsBlocked'));
      }
    } else {
      const success = await unsubscribe();
      if (success) toast.success(t('settingsPage.notificationsDisabled'));
    }
  };

  const handleLanguageChange = (val: string) => {
    i18n.changeLanguage(val);
    localStorage.setItem('app-language', val);
    const langLabel = LANGUAGES.find(l => l.code === val)?.label || val;
    toast.success(t('settingsPage.languageSet', { language: langLabel }));
  };

  // School info form state
  const [schoolName, setSchoolName] = useState(school?.name || '');
  const [schoolAddress, setSchoolAddress] = useState(school?.address || '');
  const [schoolCity, setSchoolCity] = useState(school?.city || '');
  const [schoolEmail, setSchoolEmail] = useState(school?.email || '');
  const [schoolPhone, setSchoolPhone] = useState(school?.phone || '');
  // PATCH /school/info has always accepted these three; the form just never
  // rendered them, so no school could set them. website in particular is
  // what the branded email footer reads.
  const [schoolState, setSchoolState] = useState(school?.state || '');
  const [schoolPincode, setSchoolPincode] = useState(school?.pincode || '');
  const [schoolWebsite, setSchoolWebsite] = useState(school?.website || '');

  const handleSaveSchoolInfo = async () => {
    if (!schoolId) return;
    if (!schoolName.trim()) {
      toast.error('School name is required');
      return;
    }
    if (!schoolAddress.trim()) {
      toast.error('Address is required');
      return;
    }
    if (!schoolCity.trim()) {
      toast.error('City is required');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/school/info', {
        name: schoolName.trim(),
        address: schoolAddress.trim(),
        city: schoolCity.trim(),
        email: schoolEmail.trim() || null,
        phone: schoolPhone.trim() || null,
        state: schoolState.trim() || null,
        pincode: schoolPincode.trim() || null,
        website: schoolWebsite.trim() || null,
      });
      toast.success('School information updated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { value: 'school', label: 'School', icon: School },
    { value: 'payments', label: 'Payments', icon: CreditCard },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'language', label: 'Language', icon: Globe },
  ];

  return (
      <div className="space-y-5 animate-fade-up">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          {/* Mobile: Select dropdown */}
          <div className="sm:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    <span className="flex items-center gap-2">
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Tab bar */}
          <TabsList className="hidden sm:grid sm:grid-cols-4 sm:w-[520px]">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          {/* School Settings */}
          <TabsContent value="school" className="space-y-5 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <School className="w-4 h-4" />
                  School Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Update your school's basic information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">School Name <span className="text-destructive">*</span></Label>
                    <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">School Code</Label>
                    <Input defaultValue={school?.code || ''} disabled className="opacity-60" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Address <span className="text-destructive">*</span></Label>
                    <Input value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">City <span className="text-destructive">*</span></Label>
                      <Input value={schoolCity} onChange={(e) => setSchoolCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">State</Label>
                      <Input value={schoolState} onChange={(e) => setSchoolState(e.target.value)} placeholder="Tamil Nadu" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">PIN Code</Label>
                      <Input value={schoolPincode} onChange={(e) => setSchoolPincode(e.target.value)} placeholder="600001" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Email</Label>
                      <Input type="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="school@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Phone</Label>
                      <Input value={schoolPhone} onChange={(e) => setSchoolPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Website</Label>
                    <Input value={schoolWebsite} onChange={(e) => setSchoolWebsite(e.target.value)} placeholder="https://www.yourschool.edu" />
                    <p className="text-[11px] text-muted-foreground">Shown in the footer of emails sent to your parents and staff.</p>
                  </div>
                </div>
                <Button onClick={handleSaveSchoolInfo} disabled={saving} size="sm">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payments" className="space-y-5 mt-0">
            {schoolId && <PaymentConfigSection />}
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-5 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-4 h-4" />
                  Push Notifications
                </CardTitle>
                <CardDescription className="text-xs">
                  Get alerts on this device for fee reminders, exam results and school access changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Enable push notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {!isSupported
                        ? 'This browser does not support push notifications.'
                        : permission === 'denied'
                          ? 'Blocked in your browser settings — allow notifications for this site to turn them on.'
                          : isSubscribed
                            ? 'Currently enabled on this device.'
                            : 'Currently disabled on this device.'}
                    </p>
                  </div>
                  <Switch
                    id="admin-push-notifications"
                    checked={isSubscribed}
                    onCheckedChange={handleNotificationToggle}
                    disabled={!isSupported || permission === 'denied'}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Language Settings */}
          <TabsContent value="language" className="space-y-5 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="w-4 h-4" />
                  Language Preference
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose your preferred language for the admin interface.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-sm">Interface Language</p>
                    <p className="text-xs text-muted-foreground">Select the language for all menus and labels</p>
                  </div>
                  <Select value={i18n.language} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
