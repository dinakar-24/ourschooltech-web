import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateStudent, Student } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface EditStudentDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId?: string; // Optional: for Super Admin context where useClasses won't work
}

export function EditStudentDialog({ student, open, onOpenChange, schoolId: overrideSchoolId }: EditStudentDialogProps) {
  const updateStudent = useUpdateStudent();
  const { data: hookClasses } = useClasses();

  // For Super Admin: fetch classes directly using the student's school
  // (they have no schoolId of their own, so useClasses()'s tenant-scoped
  // endpoint 404s for them — same reasoning as updateStudentAsSuperAdmin).
  const effectiveSchoolId = overrideSchoolId || student?.school_id;
  const { data: directClasses } = useQuery({
    queryKey: ['classes-direct', effectiveSchoolId],
    queryFn: async () => {
      const { data } = await api.get<{ classes: { id: string; name: string; sections: { id: string; name: string }[] }[] }>(
        `/superadmin/schools/${effectiveSchoolId}/classes`
      );
      return data.classes;
    },
    enabled: open && !!effectiveSchoolId,
  });

  // Use hookClasses if available (school admin context), otherwise use direct fetch
  const classes = (hookClasses && hookClasses.length > 0) ? hookClasses : directClasses;

  const [form, setForm] = useState({
    full_name: '',
    class_name: '',
    section: '',
    roll_number: '',
    gender: '',
    date_of_birth: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    address: '',
    status: 'active',
    avatar_url: '' as string | null,
  });

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name,
        class_name: student.class_name,
        section: student.section,
        roll_number: student.roll_number?.toString() || '',
        gender: student.gender || '',
        date_of_birth: student.date_of_birth || '',
        parent_name: student.parent_name || '',
        parent_phone: student.parent_phone || '',
        parent_email: student.parent_email || '',
        address: student.address || '',
        status: student.status || 'active',
        avatar_url: (student as any).avatar_url || null,
      });
    }
  }, [student]);

  const handleSave = async () => {
    if (!student || !form.full_name || !form.class_name || !form.section) {
      toast.error('Please fill required fields');
      return;
    }

    await updateStudent.mutateAsync({
      id: student.id,
      full_name: form.full_name,
      class_name: form.class_name,
      section: form.section,
      roll_number: form.roll_number ? parseInt(form.roll_number) : null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      parent_name: form.parent_name || null,
      parent_phone: form.parent_phone || null,
      parent_email: form.parent_email || null,
      address: form.address || null,
      status: form.status,
      avatar_url: form.avatar_url,
    } as any);

    onOpenChange(false);
  };

  const classNames = classes?.map(c => c.name) || [];
  const selectedClassData = classes?.find(c => c.name === form.class_name);
  const sections = (selectedClassData?.sections ?? []).map(s => s.name);
  const sectionOptions = sections.length > 0 ? sections : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex justify-center mb-2">
            <AvatarUpload
              value={form.avatar_url}
              onChange={(url) => setForm(f => ({ ...f, avatar_url: url }))}
              fallback={form.full_name}
              size="lg"
              folder="students"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={form.class_name || undefined} onValueChange={v => setForm(f => ({ ...f, class_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section *</Label>
              <Select value={form.section || undefined} onValueChange={v => setForm(f => ({ ...f, section: v }))}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {sectionOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roll Number</Label>
              <Input type="number" min="0" value={form.roll_number} onChange={e => setForm(f => ({ ...f, roll_number: e.target.value }))} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender || undefined} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Parent Name</Label>
              <Input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Parent Phone</Label>
              <Input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Parent Email</Label>
              <Input type="email" value={form.parent_email} onChange={e => setForm(f => ({ ...f, parent_email: e.target.value }))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateStudent.isPending}>
            {updateStudent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
