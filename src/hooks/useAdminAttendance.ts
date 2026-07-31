import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from a Supabase RPC (get_admin_attendance_by_class) to
// /api/school/attendance/by-class. That RPC did the grouping server-side;
// the Express endpoint does the same (group by class across all of a
// class's sections, not just one), so this hook stays a thin passthrough +
// rename, same as before.
// ─────────────────────────────────────────────────────────────────────────

interface ClassAttendance {
  class: string;
  present: number;
  absent: number;
  late: number;
  half_day: number;
  total: number;
  percentage: number;
}

interface RawClassAttendance {
  classId: string;
  className: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  total: number;
  percentage: number;
}

interface RawTotals {
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  total: number;
}

export function useAdminAttendance(date: Date) {
  const schoolId = useEffectiveSchoolId();
  const dateStr = date.toISOString().split('T')[0];

  return useQuery({
    queryKey: ['admin-attendance', schoolId, dateStr],
    queryFn: async () => {
      const { data } = await api.get<{ classWise: RawClassAttendance[]; totals: RawTotals }>(
        '/school/attendance/by-class',
        { params: { date: dateStr } }
      );

      const classWise: ClassAttendance[] = data.classWise.map((c) => ({
        class: c.className,
        present: c.present,
        absent: c.absent,
        late: c.late,
        half_day: c.halfDay,
        total: c.total,
        percentage: c.percentage,
      }));

      const totals = {
        present: data.totals.present,
        absent: data.totals.absent,
        late: data.totals.late,
        half_day: data.totals.halfDay,
        total: data.totals.total,
      };

      return { classWise, totals };
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}
