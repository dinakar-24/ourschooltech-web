import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

// ─────────────────────────────────────────────────────────────────────────
// External shape is UNCHANGED from the Supabase version on purpose — every
// page/component that reads `Student` keeps working with zero edits.
// Internally we now map from the Prisma/Express response instead of a
// flat Supabase row. See mapStudent() below for the exact translation.
// ─────────────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  class_name: string;
  section: string;
  roll_number: number | null;
  gender: string | null;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  address: string | null;
  avatar_url: string | null;
  status: string;
  school_id: string;
  user_id: string | null;
  academic_year_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

export interface PaginatedStudents {
  data: Student[];
  totalCount: number;
}

// Raw shape returned by GET /api/school/students and GET /api/school/students/:id
// (see backend/src/controllers/student.controller.js)
interface RawParent {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  user?: { email: string } | null;
}

export interface RawStudent {
  id: string;
  schoolId: string;
  userId: string | null;
  sectionId: string;
  admissionNo: string;
  rollNo: string | null;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  photo: string | null;
  address: string | null;
  bloodGroup: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  section?: {
    id: string;
    name: string;
    class?: { id: string; name: string; academicYearId: string } | null;
  } | null;
  // NOTE: the list endpoint (getStudents) does NOT include `parents` today —
  // only the single-student endpoint (getStudent) does. See the gap note
  // in the accompanying message. Treat as optional everywhere.
  parents?: RawParent[];
}

// Exported so lib/prefetch-helpers.ts can warm the students cache with the
// exact same shape this hook produces. A prefetch that writes a different
// shape into the same query key silently shadows the real result.
export function mapStudent(raw: RawStudent): Student {
  const parent = raw.parents && raw.parents.length > 0 ? raw.parents[0] : null;

  return {
    id: raw.id,
    admission_number: raw.admissionNo,
    full_name: `${raw.firstName} ${raw.lastName}`.trim(),
    class_name: raw.section?.class?.name ?? '',
    section: raw.section?.name ?? '',
    roll_number: raw.rollNo ? Number(raw.rollNo) || null : null,
    gender: raw.gender ?? null,
    date_of_birth: raw.dob ?? null,
    parent_name: parent ? `${parent.firstName} ${parent.lastName}`.trim() : null,
    parent_phone: parent?.phone ?? null,
    parent_email: parent?.user?.email ?? null,
    address: raw.address ?? null,
    avatar_url: raw.photo ?? null,
    status: raw.isActive ? 'active' : 'inactive',
    school_id: raw.schoolId,
    user_id: raw.userId,
    academic_year_id: raw.section?.class?.academicYearId ?? null,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

export function useStudents(filters?: {
  className?: string;
  section?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  /**
   * NEW — the backend only supports filtering by sectionId, not by
   * className/section display strings. Pass the resolved ID here (e.g.
   * from useClasses()) when you have one; className/section are kept
   * in the filter object only for cache-key stability / display.
   */
  sectionId?: string;
}) {
  const { user } = useAuth();
  const schoolId = useEffectiveSchoolId();
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: queryKeys.students(schoolId, filters),
    queryFn: async (): Promise<PaginatedStudents> => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get('/school/students', {
        params: {
          page,
          limit: pageSize,
          search: filters?.search || undefined,
          sectionId: filters?.sectionId || undefined,
        },
      });

      const mapped = (data.students as RawStudent[]).map(mapStudent);

      // ── Gaps the backend doesn't cover yet — filtered client-side on
      // just this page's rows, so these are NOT reliable across pages.
      // See message for the recommended backend fix.
      let rows = mapped;
      if (filters?.className && filters.className !== 'All Classes') {
        rows = rows.filter(s => s.class_name === filters.className);
      }
      if (filters?.section && filters.section !== 'All Sections') {
        rows = rows.filter(s => s.section === filters.section);
      }
      if (filters?.status) {
        rows = rows.filter(s => s.status === filters.status);
      }

      return { data: rows, totalCount: data.pagination.total as number };
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStudentStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.studentStats(schoolId),
    queryFn: async (): Promise<StudentStats> => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get<StudentStats>('/school/students/stats');
      return data;
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

// Created-account credentials returned once by POST /school/students when
// studentEmail/parentEmail create a login — matches CredentialsDialog.tsx's
// CreatedAccount shape exactly (role/email/password/name), which is what
// the old create-student-with-accounts Edge Function also returned.
export interface CreateStudentResult {
  student: RawStudent;
  createdAccounts: { role: string; email: string; password: string; name: string }[];
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async (studentData: {
      full_name: string;
      admission_number: string;
      // Backend requires an actual sectionId (relational FK) — className/
      // section display strings can't be resolved server-side. Pass the ID
      // from useClasses()/useSections() at the call site.
      sectionId: string;
      roll_number?: number;
      gender?: string;
      date_of_birth?: string;
      parent_name?: string;
      parent_phone?: string;
      parent_email?: string;
      alternate_phone?: string;
      student_email?: string;
      address?: string;
      blood_group?: string;
      avatar_url?: string;
    }): Promise<CreateStudentResult> => {
      if (!schoolId) throw new Error('No school ID');

      const [firstName, ...rest] = studentData.full_name.trim().split(' ');
      const lastName = rest.join(' ') || firstName;

      const { data } = await api.post('/school/students', {
        firstName,
        lastName,
        admissionNo: studentData.admission_number,
        sectionId: studentData.sectionId,
        // Student.rollNo is a Prisma String column (not Int) -- sending a
        // number here throws a Prisma validation error, surfaced to the
        // admin as an opaque "Failed to create student" 500.
        rollNo: studentData.roll_number !== undefined ? String(studentData.roll_number) : undefined,
        gender: studentData.gender,
        dob: studentData.date_of_birth,
        address: studentData.address,
        bloodGroup: studentData.blood_group,
        alternatePhone: studentData.alternate_phone,
        studentEmail: studentData.student_email,
        photo: studentData.avatar_url,
        parentName: studentData.parent_name,
        parentPhone: studentData.parent_phone,
        parentEmail: studentData.parent_email,
      });

      return { student: data.student as RawStudent, createdAccounts: data.createdAccounts || [] };
    },
    // No onError toast here — StudentsPage.tsx (today's only caller) already
    // catches and toasts the error itself via mutateAsync's rejection,
    // matching how it handled the old Edge Function's thrown errors. Adding
    // one here too would double-toast the same failure.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allStudents });
      queryClient.invalidateQueries({ queryKey: queryKeys.allStudentStats });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Student> & { id: string }) => {
      // Map the flat external shape back to what PUT /school/students/:id expects.
      const [firstName, ...rest] = (updates.full_name ?? '').trim().split(' ');

      const { data } = await api.put(`/school/students/${id}`, {
        ...(updates.full_name && { firstName, lastName: rest.join(' ') || firstName }),
        // Same String-column mismatch as useCreateStudent above.
        ...(updates.roll_number !== undefined && { rollNo: updates.roll_number === null ? null : String(updates.roll_number) }),
        ...(updates.gender && { gender: updates.gender }),
        ...(updates.date_of_birth && { dob: updates.date_of_birth }),
        ...(updates.address !== undefined && { address: updates.address }),
        ...(updates.status && { isActive: updates.status === 'active' }),
        // sectionId reassignment: pass through if the caller already
        // resolved one (see create() note above) — no className/section
        // string resolution happens here.
        ...((updates as any).sectionId && { sectionId: (updates as any).sectionId }),
        ...((updates as any).avatar_url !== undefined && { photo: (updates as any).avatar_url }),
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allStudents });
      queryClient.invalidateQueries({ queryKey: queryKeys.allStudentStats });
      toast.success('Student updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update student');
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId }: { studentId: string; userId: string | null }) => {
      // ⚠️ Backend gap: deleteStudent() in student.controller.js does a bare
      // prisma.student.deleteMany() with no FK dependency check first —
      // unlike deleteClass/deleteAcademicYear, which check counts and
      // return a clean 409. If this student has attendance, invoices,
      // results, or homework submissions, Postgres will reject the delete
      // on a foreign key constraint and the controller will surface it as
      // a raw 500, not a friendly message. Recommend adding the same
      // dependency-count-then-409 pattern used elsewhere before relying on
      // this in production.
      await api.delete(`/school/students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allStudents });
      queryClient.invalidateQueries({ queryKey: queryKeys.allStudentStats });
      toast.success('Student deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete student');
    },
  });
}
