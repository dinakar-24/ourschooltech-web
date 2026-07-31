import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/school/teacher-attendance[/mark]. The old
// hook ran two parallel Supabase queries (teachers, that date's attendance
// rows); the Express endpoint bundles both server-side into one request.
//
// Status casing: the frontend uses lowercase ('present'|'absent'|'late'|
// 'half_day'); Prisma's AttendanceStatus enum is uppercase — same mapping
// convention as useAttendance.ts's useMarkAttendance.
// ─────────────────────────────────────────────────────────────────────────

export interface TeacherAttendanceRecord {
  id: string;
  teacher_id: string;
  date: string;
  status: string;
  notes: string | null;
}

interface RawTeacher {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  photo: string | null;
}

interface RawTeacherAttendanceRecord {
  id: string;
  teacherId: string;
  date: string;
  status: string;
  notes: string | null;
}

const STATUS_TO_API: Record<string, string> = {
  present: 'PRESENT',
  absent: 'ABSENT',
  late: 'LATE',
  half_day: 'HALF_DAY',
};

const STATUS_FROM_API: Record<string, string> = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half_day',
};

export function useTeacherAttendance(date: Date) {
  const schoolId = useEffectiveSchoolId();
  const queryClient = useQueryClient();
  const dateStr = date.toISOString().split('T')[0];

  const query = useQuery({
    queryKey: ['teacher-attendance', schoolId, dateStr],
    queryFn: async () => {
      const { data } = await api.get<{ teachers: RawTeacher[]; records: RawTeacherAttendanceRecord[] }>(
        '/school/teacher-attendance',
        { params: { date: dateStr } }
      );

      return {
        teachers: data.teachers.map(t => ({
          id: t.id,
          full_name: `${t.firstName} ${t.lastName}`.trim(),
          employee_id: t.employeeId,
          avatar_url: t.photo,
        })),
        records: data.records.map(r => ({
          id: r.id,
          teacher_id: r.teacherId,
          date: r.date,
          status: STATUS_FROM_API[r.status] ?? 'present',
          notes: r.notes,
        })) as TeacherAttendanceRecord[],
      };
    },
    enabled: !!schoolId,
  });

  const saveAttendance = useMutation({
    mutationFn: async (entries: { teacher_id: string; status: string; notes?: string }[]) => {
      await api.post('/school/teacher-attendance/mark', {
        date: dateStr,
        records: entries.map(e => ({
          teacherId: e.teacher_id,
          status: STATUS_TO_API[e.status] ?? 'PRESENT',
          notes: e.notes,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
      toast.success('Teacher attendance saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });

  return { ...query, saveAttendance };
}
