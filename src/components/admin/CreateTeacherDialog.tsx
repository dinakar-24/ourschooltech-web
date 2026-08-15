import { useState, useCallback, memo, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import { User, Mail, Hash, Loader2, Mails } from 'lucide-react';
import { IndianPhoneInput } from '@/components/ui/indian-phone-input';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { api } from '@/lib/api';
import { friendlyErrorMessage } from '@/lib/error-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { CredentialsDialog, type CreatedAccount } from '@/components/admin/CredentialsDialog';

interface CreateTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const subjectOptions = [
  'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology',
  'English', 'Hindi', 'Social Studies', 'History', 'Geography',
  'Computer Science', 'Physical Education', 'Arts', 'Music',
];

const initialFormData = {
  full_name: '', email: '', phone: '', employee_id: '', subject: '', avatar_url: '' as string | null,
};

function TeacherFormContent({ formData, onChange, onSubmit, isCreating, onClose }: {
  formData: typeof initialFormData;
  onChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isCreating: boolean;
  onClose: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4 sm:px-6 pb-6">
      {/* Avatar */}
      <div className="flex justify-center">
        <AvatarUpload value={formData.avatar_url} onChange={(url) => onChange('avatar_url', url || '')} fallback={formData.full_name} folder="teachers" />
      </div>

      {/* Name & Employee ID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={formData.full_name} onChange={(e) => onChange('full_name', e.target.value)} placeholder="Enter teacher name" className="pl-10 h-11" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Employee ID</Label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={formData.employee_id} onChange={(e) => onChange('employee_id', e.target.value.toUpperCase())} placeholder="EMPXXX" className="pl-10 h-11" />
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Email <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="email" value={formData.email} onChange={(e) => onChange('email', e.target.value)} placeholder="teacher@school.edu" className="pl-10 h-11" required />
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Mails className="w-3.5 h-3.5 shrink-0" />
          A welcome email with a Set Password link will be sent to this address.
        </p>
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Phone Number</Label>
        <IndianPhoneInput value={formData.phone} onChange={(v) => onChange('phone', v)} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Primary Subject</Label>
        <div className="flex flex-wrap gap-2">
          {subjectOptions.map(sub => {
            const isSelected = formData.subject === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => onChange('subject', isSelected ? '' : sub)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {sub}
              </button>
            );
          })}
        </div>
        <Input
          value={!subjectOptions.includes(formData.subject) ? formData.subject : ''}
          onChange={(e) => onChange('subject', e.target.value)}
          placeholder="Or type subject manually"
          className="h-10 mt-1"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isCreating} className="flex-1 sm:flex-none">Cancel</Button>
        <Button type="submit" disabled={isCreating} className="flex-1 sm:flex-none sm:ml-auto">
          {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isCreating ? 'Creating…' : 'Create Teacher'}
        </Button>
      </div>
    </form>
  );
}

export const CreateTeacherDialog = memo(function CreateTeacherDialog({ open, onOpenChange, onSuccess }: CreateTeacherDialogProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [isCreating, setIsCreating] = useState(false);
  const [credentials, setCredentials] = useState<CreatedAccount[]>([]);
  const { user } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => { if (open) setFormData(initialFormData); }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    const [firstName, ...rest] = formData.full_name.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    setIsCreating(true);
    try {
      const { data } = await api.post('/school/teachers', {
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone || undefined,
        employeeId: formData.employee_id || undefined,
        subjects: formData.subject ? [formData.subject] : undefined,
        photo: formData.avatar_url || undefined,
      });
      onOpenChange(false);
      // TEMP_PASSWORD onboarding mode -- show the generated password once,
      // same dialog StudentsPage.tsx already uses for this. SET_PASSWORD
      // mode (the default) just gets a toast, nothing to reveal.
      if (data.temporaryPassword) {
        setCredentials([{ role: 'Teacher', email: formData.email, name: formData.full_name, temporaryPassword: data.temporaryPassword }]);
      } else {
        toast.success(
          data.welcomeEmailSent
            ? 'Teacher account created — welcome email sent'
            : 'Teacher account created, but the welcome email failed to send'
        );
      }
      onSuccess();
    } catch (error: any) {
      toast.error(friendlyErrorMessage(error?.response?.data?.error || 'Failed to create teacher'));
    } finally {
      setIsCreating(false);
    }
  }, [formData, user?.schoolId, onOpenChange, onSuccess]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const headerContent = (
    <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <User className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold">Add New Teacher</p>
        <p className="text-sm text-muted-foreground">Create a new teacher account</p>
      </div>
    </div>
  );

  const credentialsDialog = (
    <CredentialsDialog
      open={credentials.length > 0}
      onOpenChange={(open) => { if (!open) setCredentials([]); }}
      accounts={credentials}
      studentName={formData.full_name}
    />
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90dvh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Add New Teacher</DrawerTitle>
              <DrawerDescription>Create a new teacher account</DrawerDescription>
            </DrawerHeader>
            {headerContent}
            <div data-vaul-no-drag className="overflow-y-auto">
              <TeacherFormContent formData={formData} onChange={handleFieldChange} onSubmit={handleSubmit} isCreating={isCreating} onClose={() => onOpenChange(false)} />
            </div>
          </DrawerContent>
        </Drawer>
        {credentialsDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Add New Teacher</DialogTitle>
            <DialogDescription>Create a new teacher account</DialogDescription>
          </DialogHeader>
          {headerContent}
          <TeacherFormContent formData={formData} onChange={handleFieldChange} onSubmit={handleSubmit} isCreating={isCreating} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
      {credentialsDialog}
    </>
  );
});
