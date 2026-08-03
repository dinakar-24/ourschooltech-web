import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

// ─────────────────────────────────────────────────────────────────────────
// Reads (useTeachers/useTeacherStats/useTeacherSubjects/useAllTeachersList)
// and useUpdateTeacher migrated to Express — they all render on the same
// page (TeachersPage.tsx) and had to move together to stay internally
// consistent (list vs stats vs subject-filter options can't come from two
// different databases).
//
// `classes` (the "Assigned Classes" checkbox array) is GONE, not migrated —
// it never existed as a Teacher column in Prisma; the only real relation is
// Section.classTeacherId ("class teacher of"), which EditTeacherDialog.tsx
// already edits correctly via useUpdateSection. The old `classes` field and
// updateTeacher's Supabase-side auto-sync of it were writing into a
// database (old Supabase) the rest of the app no longer reads at all —
// harmless-looking but pure dead weight, and confusing since it *looked*
// like a second, independent way to assign a class teacher. `classes` on
// the exported Teacher type is now a derived, read-only view of
// classTeacherOf (format unchanged: "ClassName-SectionName") so
// TeachersPage.tsx's existing display badges need no changes.
//
// useAllTeachersList also had a real, live bug: it fed ClassesPage.tsx's
// and PeriodEditDialog.tsx's teacher pickers, whose selected value gets
// written into real Prisma FKs (Section.classTeacherId, presumably
// Timetable.teacherId) — but it returned OLD Supabase teacher ids, which
// don't exist in the new database. Migrating it was required, not optional,
// once classTeacherOf became the source of truth.
//
// useCreateTeacher (dead — zero callers, CreateTeacherDialog.tsx actually
// uses useCreateSchoolUser) and useDeleteTeacher (a separate Edge Function,
// delete-school-user) are untouched — out of scope for the classes/
// homeroom cleanup this batch was about.
// ─────────────────────────────────────────────────────────────────────────

export interface Teacher {
  id: string;
  user_id: string | null;
  school_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  employee_id: string;
  subjects: string[] | null;
  classes: string[] | null;
  qualification: string | null;
  joining_date: string | null;
  created_at: string;
  avatar_url?: string | null;
}

interface RawTeacher {
  id: string;
  schoolId: string;
  userId: string | null;
  employeeId: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  phone: string | null;
  qualification: string | null;
  subjects: string[];
  joiningDate: string | null;
  createdAt: string;
  user?: { email: string | null; phone: string | null } | null;
  classTeacherOf?: { id: string; name: string; class?: { name: string } | null }[];
}

function mapTeacher(raw: RawTeacher): Teacher {
  return {
    id: raw.id,
    user_id: raw.userId,
    school_id: raw.schoolId,
    full_name: `${raw.firstName} ${raw.lastName}`.trim(),
    email: raw.user?.email ?? null,
    phone: raw.phone ?? raw.user?.phone ?? null,
    employee_id: raw.employeeId,
    subjects: raw.subjects,
    classes: (raw.classTeacherOf || []).map(s => `${s.class?.name ?? ''}-${s.name}`),
    qualification: raw.qualification,
    joining_date: raw.joiningDate,
    created_at: raw.createdAt,
    avatar_url: raw.photo,
  };
}

interface TeacherFilters {
  search?: string;
  subject?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTeachers {
  data: Teacher[];
  totalCount: number;
}

export function useTeachers(filters?: TeacherFilters) {
  const schoolId = useEffectiveSchoolId();
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: queryKeys.teachers(schoolId, filters),
    queryFn: async (): Promise<PaginatedTeachers> => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get('/school/teachers', {
        params: {
          page,
          pageSize,
          search: filters?.search || undefined,
          subject: filters?.subject || undefined,
        },
      });

      return { data: (data.teachers as RawTeacher[]).map(mapTeacher), totalCount: data.total as number };
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Lightweight hook to fetch ALL teachers (id + name only) for dropdowns/comboboxes. */
export function useAllTeachersList() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.teachersList(schoolId),
    queryFn: async (): Promise<{ id: string; full_name: string }[]> => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get<{ teachers: { id: string; firstName: string; lastName: string }[] }>('/school/teachers/list');
      return data.teachers.map(t => ({ id: t.id, full_name: `${t.firstName} ${t.lastName}`.trim() }));
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.teacherStats(schoolId),
    queryFn: async () => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get<{ total: number; uniqueSubjects: number; avgClasses: number }>('/school/teachers/stats');
      return data;
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherSubjects() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.teacherSubjects(schoolId),
    queryFn: async () => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get<{ subjects: string[] }>('/school/teachers/subjects');
      return data.subjects;
    },
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000,
  });
}


export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    // email is accepted but NOT sent — updateTeacher has no email field
    // (changing a teacher's login email touches the linked User row and
    // uniqueness, a bigger change than this batch's scope; pre-existing
    // behavior, not introduced here). Everything else the dialog collects
    // now actually persists, including photo, which previously didn't.
    mutationFn: async ({ id, full_name, email, phone, qualification, subjects, joining_date, avatar_url }: {
      id: string;
      full_name?: string;
      email?: string | null;
      phone?: string | null;
      qualification?: string | null;
      subjects?: string[] | null;
      joining_date?: string | null;
      avatar_url?: string | null;
    }) => {
      const payload: Record<string, unknown> = {};
      if (full_name !== undefined) {
        const [firstName, ...rest] = full_name.trim().split(' ');
        payload.firstName = firstName;
        payload.lastName = rest.join(' ') || firstName;
      }
      if (phone !== undefined) payload.phone = phone;
      if (qualification !== undefined) payload.qualification = qualification;
      if (subjects !== undefined) payload.subjects = subjects || [];
      if (joining_date !== undefined) payload.joiningDate = joining_date;
      if (avatar_url !== undefined) payload.photo = avatar_url;

      await api.put(`/school/teachers/${id}`, payload);
      void email;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allTeachers });
      queryClient.invalidateQueries({ queryKey: queryKeys.allTeacherSubjects });
      toast.success('Teacher updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update teacher');
    },
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teacherId, userId }: { teacherId: string; userId: string | null }) => {
      await invokeEdgeFunction('delete-school-user', {
        user_id: userId,
        teacher_id: teacherId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allTeachers });
      queryClient.invalidateQueries({ queryKey: queryKeys.allTeacherStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.allTeacherSubjects });
      toast.success('Teacher deleted successfully');
    },
  });
}
