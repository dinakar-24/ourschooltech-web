import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/school/exams. The Exam/Result Prisma models
// (added by an earlier, unrelated session/batch) didn't match what
// ExamsPage.tsx/TeacherMarks.tsx/ParentResults.tsx actually need — subject
// lived on Result as a FK to the Subject table, but the admin UI's "subject"
// is a fixed string picker, not a Subject relation; Exam itself had no
// class/subject/max-marks/single-date at all. Reshaped Exam to carry
// classId/subject/examDate/maxMarks directly (one exam = one class + one
// subject, matching the real product) and dropped the now-redundant
// per-Result subjectId/maxMarks — see the schema comment on Exam.
//
// Marks entry (POST /school/exams/:id/results, used by TeacherMarks.tsx) has
// no per-teacher class/subject scoping on the server, matching the existing
// markAttendance precedent — not a new restriction, not a new gap either.
//
// `useSaveResult` (single-record save) from the original file had zero
// callers — TeacherMarks.tsx always did its own bulk delete-then-reinsert
// directly against Supabase — so it's dropped here rather than ported
// forward as dead code. TeacherMarks.tsx now calls the bulk endpoint
// directly.
// ─────────────────────────────────────────────────────────────────────────

export interface Exam {
  id: string;
  name: string;
  subject: string;
  class_name: string;
  // Additive — the old flat Supabase shape had no class id at all (just the
  // name string). TeacherMarks.tsx needs the real id to fetch that class's
  // roster via /school/students?classId=.
  class_id: string;
  exam_date: string;
  max_marks: number;
  school_id: string;
  created_at: string;
}

export interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  grade: string | null;
  remarks: string | null;
  created_at: string;
  student?: {
    full_name: string;
    admission_number: string;
  };
}

export interface ExamFormData {
  name: string;
  subject: string;
  class_name: string;
  exam_date: string;
  max_marks: number;
}

interface ExamFilters {
  className?: string;
  subject?: string;
  search?: string;
  status?: 'upcoming' | 'completed' | 'all';
  page?: number;
  pageSize?: number;
}

export interface PaginatedExams {
  data: Exam[];
  totalCount: number;
}

interface RawExam {
  id: string;
  schoolId: string;
  classId: string;
  subject: string;
  name: string;
  examDate: string;
  maxMarks: number;
  createdAt: string;
  class?: { name: string } | null;
}

interface RawExamResult {
  id: string;
  examId: string;
  studentId: string;
  marks: number;
  grade: string | null;
  remarks: string | null;
  createdAt: string;
  student?: { firstName: string; lastName: string; admissionNo: string };
}

function mapExam(raw: RawExam): Exam {
  return {
    id: raw.id,
    name: raw.name,
    subject: raw.subject,
    class_name: raw.class?.name || '',
    class_id: raw.classId,
    exam_date: raw.examDate.split('T')[0],
    max_marks: Number(raw.maxMarks),
    school_id: raw.schoolId,
    created_at: raw.createdAt,
  };
}

function mapResult(raw: RawExamResult): ExamResult {
  return {
    id: raw.id,
    exam_id: raw.examId,
    student_id: raw.studentId,
    marks_obtained: Number(raw.marks),
    grade: raw.grade,
    remarks: raw.remarks,
    created_at: raw.createdAt,
    student: raw.student
      ? { full_name: `${raw.student.firstName} ${raw.student.lastName}`, admission_number: raw.student.admissionNo }
      : undefined,
  };
}

export function useExams(filters?: ExamFilters) {
  const schoolId = useEffectiveSchoolId();
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: ['exams', schoolId, filters],
    queryFn: async (): Promise<PaginatedExams> => {
      const params: Record<string, string | number> = { page, pageSize };
      if (filters?.className && filters.className !== 'All Classes') params.className = filters.className;
      if (filters?.subject && filters.subject !== 'All Subjects') params.subject = filters.subject;
      if (filters?.search) params.search = filters.search;
      if (filters?.status && filters.status !== 'all') params.status = filters.status;

      const { data } = await api.get<{ exams: RawExam[]; totalCount: number }>('/school/exams', { params });
      return { data: data.exams.map(mapExam), totalCount: data.totalCount };
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExamStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['exam-stats', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ total: number; upcoming: number; completed: number; thisMonth: number }>('/school/exams/stats');
      return data;
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ExamFormData) => {
      const { data } = await api.post('/school/exams', {
        name: formData.name,
        subject: formData.subject,
        className: formData.class_name,
        examDate: formData.exam_date,
        maxMarks: formData.max_marks,
      });
      return data.exam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-stats'] });
      toast.success('Exam created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed to create exam');
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<ExamFormData> & { id: string }) => {
      const payload: Record<string, unknown> = {};
      if (formData.name !== undefined) payload.name = formData.name;
      if (formData.subject !== undefined) payload.subject = formData.subject;
      if (formData.class_name !== undefined) payload.className = formData.class_name;
      if (formData.exam_date !== undefined) payload.examDate = formData.exam_date;
      if (formData.max_marks !== undefined) payload.maxMarks = formData.max_marks;

      const { data } = await api.patch(`/school/exams/${id}`, payload);
      return data.exam;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-stats'] });
      toast.success('Exam updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed to update exam');
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (examId: string) => {
      await api.delete(`/school/exams/${examId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-stats'] });
      toast.success('Exam deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error.message || 'Failed to delete exam');
    },
  });
}

export function useExamResults(examId: string) {
  return useQuery({
    queryKey: ['exam-results', examId],
    queryFn: async () => {
      const { data } = await api.get<{ results: RawExamResult[] }>(`/school/exams/${examId}/results`);
      return data.results.map(mapResult);
    },
    enabled: !!examId,
    staleTime: 2 * 60 * 1000,
  });
}
