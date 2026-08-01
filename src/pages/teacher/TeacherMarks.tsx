import { useState, useMemo } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  Loader2,
  Award,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { useExams, useExamResults } from '@/hooks/useExams';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface RawClassStudent {
  id: string;
  firstName: string;
  lastName: string;
  rollNo: string | null;
  admissionNo: string;
  section?: { class?: { name: string } };
}

export default function TeacherMarks() {
  const schoolId = useEffectiveSchoolId();
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState('');
  const [localMarks, setLocalMarks] = useState<Record<string, number>>({});

  // Fetch all exams for this school (no pagination for selector)
  const { data: examsData, isLoading: examsLoading } = useExams({ pageSize: 200 });
  const exams = examsData?.data || [];

  const selectedExam = exams.find(e => e.id === selectedExamId);

  // Get unique class names and subjects for filtering
  const classNames = useMemo(() => [...new Set(exams.map(e => e.class_name))].sort(), [exams]);
  const [filterClass, setFilterClass] = useState('');
  
  const filteredExams = useMemo(() => {
    if (!filterClass) return exams;
    return exams.filter(e => e.class_name === filterClass);
  }, [exams, filterClass]);

  // Fetch students for the selected exam's class
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['class-students', schoolId, selectedExam?.class_id],
    queryFn: async () => {
      if (!schoolId || !selectedExam) return [];
      const { data } = await api.get<{ students: RawClassStudent[] }>('/school/students', {
        params: { classId: selectedExam.class_id, status: 'active', limit: 500 },
      });
      return data.students
        .map(s => ({
          id: s.id,
          full_name: `${s.firstName} ${s.lastName}`,
          roll_number: s.rollNo,
          admission_number: s.admissionNo,
        }))
        .sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true }));
    },
    enabled: !!schoolId && !!selectedExam,
  });

  // Fetch existing results for this exam
  const { data: existingResults = [], isLoading: resultsLoading } = useExamResults(selectedExamId);

  // Map existing results by student_id
  const existingResultsMap = useMemo(() => {
    const map: Record<string, number> = {};
    existingResults.forEach(r => { map[r.student_id] = r.marks_obtained; });
    return map;
  }, [existingResults]);

  const isAlreadyMarked = existingResults.length > 0;
  const maxMarks = selectedExam?.max_marks || 100;

  const getMarks = (studentId: string): number => {
    if (localMarks[studentId] !== undefined) return localMarks[studentId];
    if (existingResultsMap[studentId] !== undefined) return existingResultsMap[studentId];
    return 0;
  };

  const updateMarks = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalMarks(prev => ({ ...prev, [id]: Math.min(Math.max(numValue, 0), maxMarks) }));
  };

  // Bulk save mutation — server does the delete-then-reinsert + notification
  // fanout to the student and their parent(s) in one call.
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExamId || students.length === 0) throw new Error('No exam selected');

      const records = students.map(s => ({
        studentId: s.id,
        marksObtained: getMarks(s.id),
        grade: getGrade(getMarks(s.id)).label,
      }));

      await api.post(`/school/exams/${selectedExamId}/results`, { records });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-results', selectedExamId] });
      setLocalMarks({});
      toast.success('Marks saved successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save marks');
    },
  });

  // Stats
  const marksValues = students.map(s => getMarks(s.id));
  const avgMarks = marksValues.length > 0 ? marksValues.reduce((a, b) => a + b, 0) / marksValues.length : 0;
  const passCount = marksValues.filter(m => m >= (maxMarks * 0.35)).length;
  const failCount = marksValues.length - passCount;
  const topperMarks = marksValues.length > 0 ? Math.max(...marksValues) : 0;

  const isLoading = studentsLoading || resultsLoading;

  return (
    <MobileLayout title="Enter Marks" showBack>
      <div className="p-4 space-y-3">
        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="p-3 space-y-2.5">
            <div className="flex gap-2">
              <Select value={filterClass} onValueChange={(v) => { setFilterClass(v); setSelectedExamId(''); setLocalMarks({}); }}>
                <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Filter by class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classNames.map(cls => (<SelectItem key={cls} value={cls}>{cls}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Select value={selectedExamId} onValueChange={(v) => { setSelectedExamId(v); setLocalMarks({}); }}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                {filteredExams.map(exam => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name} — {exam.subject} ({exam.class_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!selectedExamId ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Select an Exam</h3>
            <p className="text-sm text-muted-foreground">Choose an exam above to start entering marks</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-14 w-full rounded-xl" />))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-1">No Students Found</h3>
            <p className="text-sm text-muted-foreground">No active students in {selectedExam?.class_name}.</p>
          </div>
        ) : (
          <>
            {isAlreadyMarked && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/30 rounded-xl px-3 py-2">
                <Award className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-primary">Marks already entered. You can update them.</span>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-card border border-border/50 rounded-xl p-2.5 text-center">
                <span className="text-lg font-bold text-foreground">{avgMarks.toFixed(0)}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Average</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-2.5 text-center">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{passCount}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pass</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-2.5 text-center">
                <span className="text-lg font-bold text-destructive">{failCount}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Fail</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-0.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-lg font-bold text-foreground">{topperMarks}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Highest</p>
              </div>
            </div>

            {/* Student Marks List */}
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden divide-y divide-border/50">
              {students.map((student) => {
                const m = getMarks(student.id);
                const grade = getGrade(m);
                const percentage = (m / maxMarks) * 100;
                const barColor = getBarColor(m, maxMarks);

                return (
                  <div key={student.id} className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${grade.bg} ${grade.color}`}>
                        {student.roll_number || '-'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[13px] text-foreground truncate leading-tight">{student.full_name}</p>
                        <span className={`text-[11px] font-semibold ${grade.color}`}>Grade {grade.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          value={m}
                          onChange={(e) => updateMarks(student.id, e.target.value)}
                          className="w-14 h-8 text-center text-sm font-semibold px-1"
                          min={0}
                          max={maxMarks}
                        />
                        <span className="text-[11px] text-muted-foreground">/{maxMarks}</span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spacer for sticky button */}
            <div className="h-16" />

            {/* Save Button */}
            <div className="fixed bottom-20 left-0 right-0 px-4 pb-2 z-10">
              <Button className="w-full shadow-lg" size="lg" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Marks
              </Button>
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
}

function getGrade(m: number) {
  if (m >= 90) return { label: 'A+', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' };
  if (m >= 75) return { label: 'A', color: 'text-primary', bg: 'bg-primary/10' };
  if (m >= 60) return { label: 'B', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' };
  if (m >= 45) return { label: 'C', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' };
  if (m >= 35) return { label: 'D', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' };
  return { label: 'F', color: 'text-destructive', bg: 'bg-destructive/10' };
}

function getBarColor(m: number, max: number) {
  const pct = (m / max) * 100;
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 75) return 'bg-primary';
  if (pct >= 60) return 'bg-sky-500';
  if (pct >= 45) return 'bg-amber-500';
  if (pct >= 35) return 'bg-orange-500';
  return 'bg-destructive';
}
