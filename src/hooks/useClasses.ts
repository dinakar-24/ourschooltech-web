
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/school/classes.
//
// Safe across portals: all 11 consumers are admin or teacher pages, and
// /api/school/* permits SCHOOL_ADMIN, SUPER_ADMIN and TEACHER. (Contrast
// useOnlineClasses/useTransport, which parents and students also call — those
// would 403 on the same router.)
//
// The exported Section / ClassWithSections shapes and the ['classes', schoolId]
// key are unchanged, so ClassesPage and the teacher pages need no edits.
// ─────────────────────────────────────────────────────────────────────────

export interface Section {
  id: string;
  class_id: string;
  school_id: string;
  name: string;
  class_teacher_id: string | null;
  created_at: string;
  updated_at: string;
  teacher?: {
    id: string;
    full_name: string;
  } | null;
  student_count?: number;
}

export interface ClassWithSections {
  id: string;
  school_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  sections: Section[];
}

/** Raw shapes from GET /api/school/classes */
interface RawSection {
  id: string;
  classId: string;
  schoolId: string;
  name: string;
  classTeacherId: string | null;
  createdAt: string;
  classTeacher?: { id: string; firstName: string; lastName: string } | null;
  _count?: { students: number };
}

interface RawClass {
  id: string;
  schoolId: string;
  name: string;
  order: number;
  createdAt: string;
  sections: RawSection[];
}

function mapSection(raw: RawSection): Section {
  return {
    id: raw.id,
    class_id: raw.classId,
    school_id: raw.schoolId,
    name: raw.name,
    class_teacher_id: raw.classTeacherId,
    created_at: raw.createdAt,
    // ⚠️ Section has no updatedAt column in Prisma; mirror createdAt so the
    // exported shape stays intact for consumers.
    updated_at: raw.createdAt,
    teacher: raw.classTeacher
      ? {
          id: raw.classTeacher.id,
          full_name: `${raw.classTeacher.firstName} ${raw.classTeacher.lastName}`.trim(),
        }
      : null,
    student_count: raw._count?.students ?? 0,
  };
}

function mapClass(raw: RawClass): ClassWithSections {
  return {
    id: raw.id,
    school_id: raw.schoolId,
    name: raw.name,
    display_order: raw.order,
    created_at: raw.createdAt,
    updated_at: raw.createdAt,
    sections: (raw.sections || []).map(mapSection),
  };
}

export function useClasses() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async (): Promise<ClassWithSections[]> => {
      if (!schoolId) throw new Error('No school ID');
      // Sections, their class teacher and per-section student counts all come
      // back in this one call — the old code needed three round trips plus a
      // get_student_counts_by_class RPC.
      const { data } = await api.get('/school/classes');
      return (data.classes as RawClass[]).map(mapClass);
    },
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000, // Classes rarely change — long cache
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, displayOrder, sections, academicYearId }: {
      name: string;
      displayOrder?: number;
      sections?: string[];
      /** Optional — resolved from the current academic year when omitted. */
      academicYearId?: string;
    }) => {
      // POST /school/classes requires an academicYearId FK, which the old
      // Supabase insert didn't. Resolve it here rather than changing the call
      // site — and read it from Express, not useCurrentAcademicYear(), which
      // is still Supabase-backed and would return nothing.
      let yearId = academicYearId;
      if (!yearId) {
        const { data: yearData } = await api.get('/school/academic-years');
        // getAcademicYears responds { years } ordered by startDate desc.
        const list = (yearData.years || []) as Array<{ id: string; isCurrent: boolean }>;
        yearId = (list.find(y => y.isCurrent) || list[0])?.id;
      }

      if (!yearId) {
        throw new Error('No academic year found. Create one before adding classes.');
      }

      const { data } = await api.post('/school/classes', {
        name,
        order: displayOrder || 0,
        academicYearId: yearId,
      });

      const newClass = data.class as RawClass;

      // No bulk section endpoint — create them one by one, same as before.
      if (sections && sections.length > 0) {
        await Promise.all(
          sections.map(sectionName =>
            api.post(`/school/classes/${newClass.id}/sections`, { name: sectionName }),
          ),
        );
      }

      return newClass;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create class');
    },
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classId, name, classTeacherId }: {
      classId: string;
      name: string;
      classTeacherId?: string;
    }) => {
      const { data } = await api.post(`/school/classes/${classId}/sections`, {
        name,
        classTeacherId: classTeacherId || null,
      });
      return data.section;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Section added successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to add section');
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classTeacherId }: {
      id: string;
      classTeacherId?: string | null;
    }) => {
      // The old implementation also hand-maintained a `teachers.classes` string
      // array on both the previous and new teacher — six extra queries to keep
      // a denormalised field in sync. The Section → Teacher FK replaces it, so
      // this is now a single call.
      const { data } = await api.put(`/school/sections/${id}`, {
        classTeacherId: classTeacherId ?? null,
      });
      return data.section;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Section updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update section');
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classId: string) => {
      await api.delete(`/school/classes/${classId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Class deleted successfully');
    },
    onError: (error: any) => {
      // The endpoint returns 409 CLASS_HAS_DEPENDENCIES with counts rather than
      // letting Postgres reject the delete on a foreign key.
      const data = error?.response?.data;
      if (data?.code === 'CLASS_HAS_DEPENDENCIES') {
        const d = data.dependencies || {};
        toast.error(
          `Cannot delete: this class still has ${d.sections || 0} section(s), ` +
          `${d.subjects || 0} subject(s) and ${d.feeStructures || 0} fee structure(s).`
        );
        return;
      }
      toast.error(data?.error || 'Failed to delete class');
    },
  });
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  class_id: string;
}

/** Real subjects for a class -- used by the Timetable grid's Subject picker
 * (previously free text). No classId filter server-side; filters client-side
 * against the already-small whole-school list, same as useSections. */
export function useSubjects(classId?: string) {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: async (): Promise<Subject[]> => {
      const { data } = await api.get('/school/subjects');
      return (data.subjects as Array<{ id: string; name: string; code: string | null; classId: string }>).map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        class_id: s.classId,
      }));
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
    select: (subjects) => classId ? subjects.filter(s => s.class_id === classId) : subjects,
  });
}
