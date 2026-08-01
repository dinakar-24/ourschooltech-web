import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useParentChild } from '@/hooks/useParentData';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Award, FileText } from 'lucide-react';

interface ExamResult {
  id: string;
  marks_obtained: number;
  grade: string | null;
  remarks: string | null;
  exam: {
    id: string;
    name: string;
    subject: string;
    max_marks: number;
    exam_date: string;
    class_name: string;
  };
}

interface RawChildResult {
  id: string;
  marks: number;
  grade: string | null;
  remarks: string | null;
  exam: {
    id: string;
    name: string;
    subject: string;
    maxMarks: number;
    examDate: string;
    class?: { name: string } | null;
  };
}

// GET /api/parent/results/:studentId — the endpoint verifies server-side
// that studentId is actually this parent's own child before returning
// anything (see the route's comment in parent.js); a parent can't read
// another family's results by editing the id in this query.
function useChildResults(studentId?: string) {
  return useQuery({
    queryKey: ['child-results', studentId],
    queryFn: async (): Promise<ExamResult[]> => {
      if (!studentId) return [];
      const { data } = await api.get<{ results: RawChildResult[] }>(`/parent/results/${studentId}`);
      return data.results.map(r => ({
        id: r.id,
        marks_obtained: Number(r.marks),
        grade: r.grade,
        remarks: r.remarks,
        exam: {
          id: r.exam.id,
          name: r.exam.name,
          subject: r.exam.subject,
          max_marks: Number(r.exam.maxMarks),
          exam_date: r.exam.examDate,
          class_name: r.exam.class?.name || '',
        },
      }));
    },
    enabled: !!studentId,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

const getGradeColor = (grade: string | null) => {
  if (!grade) return 'text-muted-foreground';
  if (grade.startsWith('A')) return 'text-success';
  if (grade.startsWith('B')) return 'text-primary';
  if (grade.startsWith('C')) return 'text-warning';
  return 'text-destructive';
};

export default function ParentResults() {
  const { data: child, isLoading: childLoading } = useParentChild();
  const { data: results = [], isLoading: resultsLoading } = useChildResults(child?.id);

  const isLoading = childLoading || resultsLoading;

  // Group results by exam name
  const examGroups = results.reduce<Record<string, ExamResult[]>>((acc, r) => {
    const key = r.exam.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const examNames = Object.keys(examGroups);

  // Latest exam stats
  const latestExamName = examNames[0];
  const latestResults = latestExamName ? examGroups[latestExamName] : [];
  const latestTotalMarks = latestResults.reduce((s, r) => s + r.marks_obtained, 0);
  const latestMaxMarks = latestResults.reduce((s, r) => s + r.exam.max_marks, 0);
  const latestPercentage = latestMaxMarks > 0 ? Math.round((latestTotalMarks / latestMaxMarks) * 100 * 10) / 10 : 0;

  // Determine overall grade from percentage
  const overallGrade = latestPercentage >= 90 ? 'A+' : latestPercentage >= 80 ? 'A' : latestPercentage >= 70 ? 'B+' : latestPercentage >= 60 ? 'B' : latestPercentage >= 50 ? 'C' : 'D';

  return (
    <MobileLayout title="Results" showBack>
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Award className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No Results Yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Exam results will appear here once published.
            </p>
          </div>
        ) : (
          <>
            {/* Latest Exam Summary */}
            {latestExamName && (
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
                <CardContent className="p-5">
                  <p className="text-primary-foreground/70 text-sm">{latestExamName}</p>
                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="text-4xl font-bold">{latestPercentage}%</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-white/20 text-white">
                          Grade: {overallGrade}
                        </Badge>
                        <span className="text-sm text-primary-foreground/80">
                          {latestTotalMarks}/{latestMaxMarks}
                        </span>
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                      <Award className="w-8 h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subject-wise for Latest Exam */}
            {latestExamName && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Subject-wise Marks
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-4">
                    {latestResults.map((r) => (
                      <div key={r.id}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{r.exam.subject}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${getGradeColor(r.grade)}`}>
                              {r.marks_obtained}/{r.exam.max_marks}
                            </span>
                            {r.grade && (
                              <Badge variant="outline" className={getGradeColor(r.grade)}>
                                {r.grade}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress
                          value={(r.marks_obtained / r.exam.max_marks) * 100}
                          className="h-2"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Previous Exams */}
            {examNames.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Previous Exams
                </h3>
                <div className="space-y-2">
                  {examNames.slice(1).map((examName) => {
                    const exResults = examGroups[examName];
                    const total = exResults.reduce((s, r) => s + r.marks_obtained, 0);
                    const max = exResults.reduce((s, r) => s + r.exam.max_marks, 0);
                    const pct = max > 0 ? Math.round((total / max) * 100) : 0;
                    const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D';
                    const examDate = exResults[0]?.exam.exam_date;

                    return (
                      <Card key={examName}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{examName}</p>
                              {examDate && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{pct}%</p>
                            <Badge variant="outline" className={getGradeColor(grade)}>
                              {grade}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}
