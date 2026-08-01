import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, GraduationCap } from 'lucide-react';
import { useUpdateTeacher, Teacher } from '@/hooks/useTeachers';
import { useClasses } from '@/hooks/useClasses';
import { useUpdateSection } from '@/hooks/useClasses';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { AvatarUpload } from '@/components/ui/avatar-upload';

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
  'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Physical Education',
  'Sanskrit', 'Economics', 'Accountancy', 'Business Studies', 'History', 'Geography', 'Art',
];

interface EditTeacherDialogProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTeacherDialog({ teacher, open, onOpenChange }: EditTeacherDialogProps) {
  const updateTeacher = useUpdateTeacher();
  const updateSection = useUpdateSection();
  const { data: dbClasses } = useClasses();
  const isMobile = useIsMobile();

  // Build all section options with IDs
  const allSections = useMemo(() => {
    return (dbClasses || []).flatMap(cls =>
      (cls.sections ?? []).map(sec => ({
        id: sec.id,
        label: `${cls.name} - ${sec.name}`,
        classTeacherId: sec.class_teacher_id,
      }))
    );
  }, [dbClasses]);

  // Track which sections this teacher is class teacher of
  const [classTeacherSections, setClassTeacherSections] = useState<string[]>([]);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    qualification: '',
    subjects: [] as string[],
    joining_date: '',
    avatar_url: null as string | null,
  });

  const [subjectInput, setSubjectInput] = useState('');

  useEffect(() => {
    if (teacher) {
      setForm({
        full_name: teacher.full_name,
        email: teacher.email || '',
        phone: teacher.phone || '',
        qualification: teacher.qualification || '',
        subjects: teacher.subjects || [],
        joining_date: teacher.joining_date || '',
        avatar_url: teacher.avatar_url || null,
      });
      // Find sections where this teacher is class teacher
      const teacherSectionIds = allSections
        .filter(s => s.classTeacherId === teacher.id)
        .map(s => s.id);
      setClassTeacherSections(teacherSectionIds);
    }
  }, [teacher, allSections]);

  const toggleSubject = (sub: string) => {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(sub)
        ? f.subjects.filter(s => s !== sub)
        : [...f.subjects, sub],
    }));
  };

  const addCustomSubject = () => {
    if (subjectInput.trim() && !form.subjects.includes(subjectInput.trim())) {
      setForm(f => ({ ...f, subjects: [...f.subjects, subjectInput.trim()] }));
      setSubjectInput('');
    }
  };

  const toggleClassTeacherSection = (sectionId: string) => {
    setClassTeacherSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSave = async () => {
    if (!teacher || !form.full_name) {
      toast.error('Name is required');
      return;
    }

    await updateTeacher.mutateAsync({
      id: teacher.id,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      qualification: form.qualification || null,
      subjects: form.subjects.length > 0 ? form.subjects : null,
      joining_date: form.joining_date || null,
      avatar_url: form.avatar_url,
    });

    // Sync class teacher assignments
    // Find original sections this teacher was class teacher of
    const originalSectionIds = allSections
      .filter(s => s.classTeacherId === teacher.id)
      .map(s => s.id);

    // Sections to remove this teacher from
    const toRemove = originalSectionIds.filter(id => !classTeacherSections.includes(id));
    // Sections to add this teacher to
    const toAdd = classTeacherSections.filter(id => !originalSectionIds.includes(id));

    for (const sectionId of toRemove) {
      await updateSection.mutateAsync({ id: sectionId, classTeacherId: null });
    }
    for (const sectionId of toAdd) {
      await updateSection.mutateAsync({ id: sectionId, classTeacherId: teacher.id });
    }

    onOpenChange(false);
  };

  const formContent = (
    <div className="space-y-4">
      {/* Profile Photo */}
      <AvatarUpload
        value={form.avatar_url}
        onChange={(url) => setForm(f => ({ ...f, avatar_url: url }))}
        fallback={form.full_name}
        folder="teachers"
        size="lg"
        className="mb-2"
      />

      {/* Name - full width */}
      <div className="space-y-2">
        <Label>Full Name *</Label>
        <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
      </div>

      {/* Email & Phone - stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
      </div>

      {/* Qualification & Joining Date - stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Qualification</Label>
          <Input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Joining Date</Label>
          <Input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} />
        </div>
      </div>

      {/* Subjects */}
      <div className="space-y-2">
        <Label>Subjects</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SUBJECTS.slice(0, 10).map(sub => (
            <Badge
              key={sub}
              variant={form.subjects.includes(sub) ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => toggleSubject(sub)}
            >
              {sub}
            </Badge>
          ))}
        </div>
        {form.subjects.filter(s => !SUBJECTS.slice(0, 10).includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.subjects.filter(s => !SUBJECTS.slice(0, 10).includes(s)).map(sub => (
              <Badge key={sub} variant="default" className="text-xs">
                {sub}
                <button onClick={() => toggleSubject(sub)} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Add custom subject"
            value={subjectInput}
            onChange={e => setSubjectInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSubject())}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomSubject}>Add</Button>
        </div>
      </div>

      {/* Class Teacher of — the one real relation (Section.classTeacherId).
          The old "Assigned Classes" checkbox array lived here too, backed by
          a Teacher.classes column that never existed in Prisma; removed
          rather than fixed, since this section already correctly edits the
          same underlying relationship. */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4" />
          Class Teacher of
        </Label>
        {allSections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {allSections.map(sec => {
              const isSelected = classTeacherSections.includes(sec.id);
              const assignedToOther = sec.classTeacherId && sec.classTeacherId !== teacher?.id;
              return (
                <Badge
                  key={sec.id}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs ${assignedToOther ? 'opacity-50' : ''}`}
                  onClick={() => {
                    if (assignedToOther) {
                      toast.info(`This section already has a class teacher assigned`);
                      return;
                    }
                    toggleClassTeacherSection(sec.id);
                  }}
                >
                  {sec.label}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sections configured yet.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background pb-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={handleSave} disabled={updateTeacher.isPending || updateSection.isPending}>
          {(updateTeacher.isPending || updateSection.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6 max-h-[85dvh] flex flex-col bg-background">
          <DrawerHeader className="text-left px-0">
            <DrawerTitle>Edit Teacher</DrawerTitle>
          </DrawerHeader>
          <div data-vaul-no-drag className="overflow-y-auto flex-1 min-h-0">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Teacher</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
