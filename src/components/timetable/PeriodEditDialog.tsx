import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllTeachersList } from '@/hooks/useTeachers';
import { useSubjects } from '@/hooks/useClasses';
import { Loader2 } from 'lucide-react';

interface PeriodEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    subject_id: string | null;
    teacher_id: string | null;
    start_time: string;
    end_time: string;
    is_lunch: boolean;
    apply_all_days: boolean;
  }) => void;
  isSaving?: boolean;
  initialData?: {
    subject_id?: string | null;
    teacher_id?: string | null;
    start_time?: string;
    end_time?: string;
    is_lunch?: boolean;
  };
  periodNumber: number;
  dayOfWeek: string;
  classId: string;
}

export function PeriodEditDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
  initialData,
  periodNumber,
  dayOfWeek,
  classId,
}: PeriodEditDialogProps) {
  const { data: teachers } = useAllTeachersList();
  const { data: subjects } = useSubjects(classId);
  const [subjectId, setSubjectId] = useState<string>('none');
  const [teacherId, setTeacherId] = useState<string>('none');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:30');
  const [isLunch, setIsLunch] = useState(false);
  const [applyAllDays, setApplyAllDays] = useState(false);

  useEffect(() => {
    if (open) {
      setSubjectId(initialData?.subject_id || 'none');
      setTeacherId(initialData?.teacher_id || 'none');
      setStartTime(initialData?.start_time || '08:00');
      setEndTime(initialData?.end_time || '08:30');
      setIsLunch(initialData?.is_lunch || false);
      setApplyAllDays(false);
    }
  }, [open, initialData]);

  const handleSave = () => {
    onSave({
      subject_id: isLunch ? null : (subjectId === 'none' ? null : subjectId),
      teacher_id: isLunch ? null : (teacherId === 'none' ? null : teacherId),
      start_time: startTime,
      end_time: endTime,
      is_lunch: isLunch,
      apply_all_days: applyAllDays,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Edit' : 'Add'} Period {periodNumber} — {dayOfWeek}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Is Lunch */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-lunch"
              checked={isLunch}
              onCheckedChange={(c) => setIsLunch(!!c)}
            />
            <Label htmlFor="is-lunch" className="text-sm font-medium">
              This is a Lunch / Break period
            </Label>
          </div>

          {/* Time fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Time</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Time</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {!isLunch && (
            <>
              {/* Teacher */}
              <div className="space-y-1.5">
                <Label className="text-xs">Teacher</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Teacher</SelectItem>
                    {teachers?.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Subject</SelectItem>
                    {subjects?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subjects?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No subjects set up for this class yet — add one from the Classes page first.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Apply to all days */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="apply-all"
              checked={applyAllDays}
              onCheckedChange={(c) => setApplyAllDays(!!c)}
            />
            <Label htmlFor="apply-all" className="text-sm">
              Change for complete week
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || (!isLunch && subjectId === 'none')}>
            {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
