import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import { UserPlus, Building2, User, Mail, Mails } from 'lucide-react';
import { IndianPhoneInput } from '@/components/ui/indian-phone-input';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { friendlyErrorMessage } from '@/lib/error-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { CredentialsDialog, type CreatedAccount } from '@/components/admin/CredentialsDialog';

interface School {
  id: string;
  name: string;
  code: string;
}

interface CreateSchoolAdminDialogProps {
  schools: School[];
  onSuccess: () => void;
}

function AdminForm({ formData, update, handleSubmit, isCreating, schools, onClose }: {
  formData: { email: string; fullName: string; schoolId: string; phone: string };
  update: (field: string, value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isCreating: boolean;
  schools: School[];
  onClose: () => void;
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 sm:px-6 pb-6">
      {/* Avatar */}
      <div className="flex justify-center">
        <AvatarUpload value={null} onChange={() => {}} fallback={formData.fullName} folder="admins" />
      </div>

      {/* Full Name */}
      <div className="space-y-1.5">
        <Label htmlFor="admin-fullName" className="text-sm font-medium">
          Full Name <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="admin-fullName"
            value={formData.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder="Enter full name"
            className="pl-10 h-11"
            required
          />
        </div>
      </div>

      {/* Email & Phone row on larger screens, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="admin-email" className="text-sm font-medium">
            Email <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="admin-email"
              type="email"
              value={formData.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="Enter email"
              className="pl-10 h-11"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mails className="w-3.5 h-3.5 shrink-0" />
            A welcome email with a Set Password link will be sent here.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="admin-phone" className="text-sm font-medium">
            Phone
          </Label>
          <IndianPhoneInput
            id="admin-phone"
            value={formData.phone}
            onChange={(v) => update('phone', v)}
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Assign to School */}
      <div className="space-y-1.5">
        <Label htmlFor="admin-school" className="text-sm font-medium">
          Assign to School <span className="text-destructive">*</span>
        </Label>
        <Select value={formData.schoolId} onValueChange={(v) => update('schoolId', v)}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select a school" />
          </SelectTrigger>
          <SelectContent>
            {schools.map((school) => (
              <SelectItem key={school.id} value={school.id}>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-medium">{school.name}</span>
                  <span className="text-xs text-muted-foreground">({school.code})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating} className="flex-1 sm:flex-none sm:ml-auto">
          {isCreating ? 'Creating…' : 'Create Admin'}
        </Button>
      </div>
    </form>
  );
}

export function CreateSchoolAdminDialog({ schools, onSuccess }: CreateSchoolAdminDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({
    email: '', fullName: '', schoolId: '', phone: '',
  });

  const [isCreating, setIsCreating] = useState(false);
  const [credentials, setCredentials] = useState<CreatedAccount[]>([]);

  const resetForm = () => setFormData({ email: '', fullName: '', schoolId: '', phone: '' });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.schoolId) { toast.error('Please select a school'); return; }

    const [firstName, ...rest] = formData.fullName.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    setIsCreating(true);
    try {
      const { data } = await api.post('/superadmin/school-admins', {
        schoolId: formData.schoolId,
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone || undefined,
      });
      setIsOpen(false);
      // TEMP_PASSWORD onboarding mode -- show the generated password once.
      // Captured before resetForm() clears formData below.
      if (data.temporaryPassword) {
        setCredentials([{ role: 'School Admin', email: formData.email, name: formData.fullName, temporaryPassword: data.temporaryPassword }]);
      } else {
        toast.success(
          data.welcomeEmailSent
            ? 'School admin account created — welcome email sent'
            : 'School admin account created, but the welcome email failed to send'
        );
      }
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast.error(friendlyErrorMessage(error?.response?.data?.error || 'Failed to create school admin'));
    } finally {
      setIsCreating(false);
    }
  };

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const triggerButton = (
    <Button className="w-full sm:w-auto gap-2">
      <UserPlus className="w-4 h-4" />
      Add School Admin
    </Button>
  );

  const headerContent = (
    <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <UserPlus className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold">Add School Admin</p>
        <p className="text-sm text-muted-foreground">Create a new administrator account</p>
      </div>
    </div>
  );

  const credentialsDialog = (
    <CredentialsDialog
      open={credentials.length > 0}
      onOpenChange={(open) => { if (!open) setCredentials([]); }}
      accounts={credentials}
      studentName={credentials[0]?.name || ''}
    />
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={handleOpenChange}>
          <DrawerTrigger asChild>
            {triggerButton}
          </DrawerTrigger>
          <DrawerContent className="max-h-[90dvh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Add School Admin</DrawerTitle>
              <DrawerDescription>Create a new administrator account</DrawerDescription>
            </DrawerHeader>
            {headerContent}
            <div data-vaul-no-drag className="overflow-y-auto">
              <AdminForm
                formData={formData}
                update={update}
                handleSubmit={handleSubmit}
                isCreating={isCreating}
                schools={schools}
                onClose={() => setIsOpen(false)}
              />
            </div>
          </DrawerContent>
        </Drawer>
        {credentialsDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {triggerButton}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Add School Admin</DialogTitle>
            <DialogDescription>Create a new administrator account</DialogDescription>
          </DialogHeader>
          {headerContent}
          <AdminForm
            formData={formData}
            update={update}
            handleSubmit={handleSubmit}
            isCreating={isCreating}
            schools={schools}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
      {credentialsDialog}
    </>
  );
}
