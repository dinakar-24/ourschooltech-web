import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, X, School as SchoolIcon } from 'lucide-react';
import { useSchools } from '@/hooks/useSchools';
import { useUserMemberships, useGrantMembership, useRevokeMembership } from '@/hooks/useSchoolMemberships';

interface ManageSchoolAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const ROLE_OPTIONS = [
  { value: 'SCHOOL_ADMIN', label: 'School Admin' },
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'STUDENT', label: 'Student' },
];

const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  STUDENT: 'Student',
};

export function ManageSchoolAccessDialog({ open, onOpenChange, userId, userName }: ManageSchoolAccessDialogProps) {
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newRole, setNewRole] = useState('');

  const { data: memberships, isLoading } = useUserMemberships(open ? userId : null);
  const { data: schoolsResult } = useSchools({ pageSize: 200 });
  const grantMembership = useGrantMembership(userId);
  const revokeMembership = useRevokeMembership(userId);

  const activeMemberships = (memberships ?? []).filter(m => m.isActive);
  const grantedSchoolIds = new Set(activeMemberships.map(m => m.schoolId));
  const availableSchools = (schoolsResult?.data ?? []).filter(s => !grantedSchoolIds.has(s.id));

  const handleGrant = async () => {
    if (!newSchoolId || !newRole) return;
    await grantMembership.mutateAsync({ schoolId: newSchoolId, role: newRole });
    setNewSchoolId('');
    setNewRole('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Manage School Access
          </DialogTitle>
          <DialogDescription>
            Schools {userName} can log into, each with their own role. Removing access here doesn't delete any of their data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : activeMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No school access granted yet.</p>
            ) : (
              activeMemberships.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 border rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <SchoolIcon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{m.school.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{ROLE_LABELS[m.role] || m.role}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    disabled={revokeMembership.isPending}
                    onClick={() => revokeMembership.mutate(m.schoolId)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium">Grant access to another school</p>
            <div className="flex gap-2">
              <Select value={newSchoolId} onValueChange={setNewSchoolId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="School" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!newSchoolId || !newRole || grantMembership.isPending}
              onClick={handleGrant}
            >
              <Plus className="w-4 h-4 mr-2" />
              {grantMembership.isPending ? 'Granting...' : 'Grant Access'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
