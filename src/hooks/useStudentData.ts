import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────
// useStudentProfile, useStudentAttendanceStats, useStudentAnnouncements
// migrated to /api/student/{profile,attendance,announcements}.
// useStudentHomework and useStudentResults below are untouched Supabase —
// out of scope for this batch, no batch assigned to them yet.
//
// Parent contact fields (parent_name/parent_phone/parent_email/
// alternate_phone) are dropped from useStudentProfile's return, not
// fabricated: Student has no such columns — that data lives on the related
// Parent record. GET /api/student/profile does already include a `parents`
// relation, so this is wireable later if wanted; same "flag it, don't
// guess" pattern as alternate_phone in the Parent batch.
//
// useStudentAnnouncements previously took a `className` param to filter by
// `target_classes` client-side; Announcement has no target_classes (or
// is_active) column in the current schema, so that filtering is gone along
// with the param — GET /api/student/announcements already scopes to
// targetRole IS NULL OR 'STUDENT' server-side.
// ─────────────────────────────────────────────────────────────────────────

interface RawStudentProfile {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  rollNo: string | null;
  admissionNo: string;
  photo: string | null;
  dob: string;
  gender: string;
  bloodGroup: string | null;
  address: string | null;
  section: { name: string; class: { name: string } };
}

export interface StudentProfile {
  id: string;
  full_name: string;
  class_name: string;
  section: string;
  roll_number: number | null;
  admission_number: string;
  school_id: string;
  avatar_url: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  alternate_phone: string | null;
}

export interface StudentAttendanceStats {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export function useStudentProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async (): Promise<StudentProfile | null> => {
      try {
        const { data } = await api.get<{ student: RawStudentProfile }>('/student/profile');
        const s = data.student;

        return {
          id: s.id,
          full_name: `${s.firstName} ${s.lastName}`.trim(),
          class_name: s.section?.class?.name ?? '',
          section: s.section?.name ?? '',
          roll_number: s.rollNo ? Number(s.rollNo) || null : null,
          admission_number: s.admissionNo,
          school_id: s.schoolId,
          avatar_url: s.photo,
          parent_name: null,
          parent_phone: null,
          parent_email: null,
          alternate_phone: null,
          date_of_birth: s.dob,
          gender: s.gender,
          blood_group: s.bloodGroup,
          address: s.address,
        };
      } catch (err: any) {
        // No Student row linked to this user yet — StudentProfile/
        // StudentDashboard both render a "profile not linked" state for
        // this, same as the old PGRST116 (no rows) handling.
        if (err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStudentAttendanceStats(studentId?: string) {
  return useQuery({
    queryKey: ['student-attendance-stats', studentId],
    queryFn: async (): Promise<StudentAttendanceStats> => {
      if (!studentId) throw new Error('No student ID');

      const { data } = await api.get<{ summary: StudentAttendanceStats }>('/student/attendance');
      return data.summary;
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Raw shape shared by GET /api/student/homework and /api/parent/homework/:studentId
export interface RawHomework {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  attachments: string[];
  subject?: { name: string } | null;
}

export function mapHomework(raw: RawHomework) {
  return {
    id: raw.id,
    subject: raw.subject?.name ?? '',
    title: raw.title,
    description: raw.description,
    due_date: raw.dueDate,
    attachments: raw.attachments || [],
  };
}

export function useStudentHomework() {
  return useQuery({
    queryKey: ['student-homework'],
    queryFn: async () => {
      const { data } = await api.get<{ homework: RawHomework[] }>('/student/homework');
      // The endpoint orders dueDate desc (most-recently-due first, for a
      // general "recent homework" list); both consumer pages want soonest-
      // due-first, matching the old direct query's ascending order.
      return [...data.homework]
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map(mapHomework);
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

interface RawResult {
  id: string;
  marks: number;
  grade: string | null;
  exam?: { name: string; subject: string; maxMarks: number; examDate: string } | null;
}

function mapResult(raw: RawResult) {
  return {
    id: raw.id,
    marks_obtained: raw.marks,
    grade: raw.grade,
    exam: raw.exam
      ? { name: raw.exam.name, subject: raw.exam.subject, max_marks: raw.exam.maxMarks, exam_date: raw.exam.examDate }
      : null,
  };
}

export function useStudentResults(studentId?: string) {
  return useQuery({
    queryKey: ['student-results', studentId],
    queryFn: async () => {
      const { data } = await api.get<{ results: RawResult[] }>('/student/results');
      return data.results.map(mapResult);
    },
    enabled: !!studentId,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStudentAnnouncements(schoolId?: string) {
  return useQuery({
    queryKey: ['student-announcements', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{
        announcements: { id: string; title: string; content: string; createdAt: string }[];
      }>('/student/announcements');

      return data.announcements.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        created_at: a.createdAt,
      }));
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
