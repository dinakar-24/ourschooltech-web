import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/query-keys';

// ─────────────────────────────────────────────────────────────────────────
// useClassAttendance and useMarkAttendance are migrated to
// GET/POST /api/teacher/attendance[/mark] (TeacherAttendance.tsx).
//
// The old absence-notification flow in useMarkAttendance.onSuccess is DROPPED,
// not ported: it read `students.parent_email` and looked up `profiles` by
// email, neither of which exist in the Express schema. Notifying a student's
// parents on absence needs to go through the real Student.parents relation
// (see parent.js /children) and is new functionality, not a like-for-like
// port — flagged for a future batch.
//
// Status casing: the frontend uses lowercase ('present'|'absent'|'late'|
// 'half_day'); Prisma's AttendanceStatus enum is uppercase. Mapped both ways
// at the API boundary below.
// ─────────────────────────────────────────────────────────────────────────

export type AttendanceStatusValue = 'present' | 'absent' | 'late' | 'half_day';

const STATUS_TO_API: Record<AttendanceStatusValue, string> = {
  present: 'PRESENT',
  absent: 'ABSENT',
  late: 'LATE',
  half_day: 'HALF_DAY',
};

const STATUS_FROM_API: Record<string, AttendanceStatusValue> = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half_day',
};

/** Raw shape of GET /api/teacher/attendance */
interface RawTeacherAttendanceRow {
  id: string;
  studentId: string;
  schoolId: string;
  sectionId: string;
  date: string;
  status: string;
  remarks: string | null;
}

export function useClassAttendance(date: Date, className: string, section: string) {
  const schoolId = useEffectiveSchoolId();
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: queryKeys.classAttendance(schoolId, dateStr, className, section),
    queryFn: async () => {
      if (!schoolId) throw new Error('No school ID');

      const { data: sections } = await api.get<{ sections: Array<{ sectionId: string; sectionName: string; className: string }> }>('/teacher/classes');
      const match = sections.sections.find(s => s.className === className && s.sectionName === section);

      if (!match) {
        return { students: [], attendance: new Map<string, RawTeacherAttendanceRow>(), isMarked: false };
      }

      const [{ data: studentsRes }, { data: attendanceRes }] = await Promise.all([
        api.get<{ students: Array<{ id: string; firstName: string; lastName: string; admissionNo: string; rollNo: string | null }> }>(`/teacher/students/${match.sectionId}`),
        api.get<{ attendance: RawTeacherAttendanceRow[] }>('/teacher/attendance', { params: { sectionId: match.sectionId, date: dateStr } }),
      ]);

      const students = studentsRes.students
        .map(s => ({
          id: s.id,
          full_name: `${s.firstName} ${s.lastName}`.trim(),
          admission_number: s.admissionNo,
          roll_number: s.rollNo ? Number(s.rollNo) || null : null,
        }))
        .sort((a, b) => (a.roll_number ?? Infinity) - (b.roll_number ?? Infinity));

      const attendanceMap = new Map(
        attendanceRes.attendance.map(a => [a.studentId, { ...a, status: STATUS_FROM_API[a.status] ?? 'present' }])
      );

      return {
        students,
        attendance: attendanceMap,
        isMarked: attendanceRes.attendance.length > 0,
      };
    },
    enabled: !!schoolId && !!className && !!section,
    staleTime: 1 * 60 * 1000,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async ({
      date,
      records
    }: {
      date: string;
      records: { studentId: string; status: AttendanceStatusValue; notes?: string }[];
    }) => {
      await api.post('/teacher/attendance/mark', {
        date,
        records: records.map(r => ({ studentId: r.studentId, status: STATUS_TO_API[r.status] })),
      });
    },
    // ── Optimistic UI: update class attendance cache instantly ──
    onMutate: async (variables) => {
      const { date, records } = variables;
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.allClassAttendance });
      await queryClient.cancelQueries({ queryKey: queryKeys.allAttendanceSummary });

      // Snapshot previous class attendance data for rollback
      const previousQueries = queryClient.getQueriesData({ queryKey: queryKeys.allClassAttendance });

      // Optimistically update attendance maps in cache
      previousQueries.forEach(([key, data]: [any, any]) => {
        if (!data?.attendance || !data?.students) return;
        const newMap = new Map(data.attendance);
        records.forEach(r => {
          newMap.set(r.studentId, {
            studentId: r.studentId,
            schoolId,
            date,
            status: r.status,
            remarks: r.notes || null,
          });
        });
        queryClient.setQueryData(key, {
          ...data,
          attendance: newMap,
          isMarked: true,
        });
      });

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic update
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      toast.error('Failed to save attendance. Changes reverted.');
    },
    onSuccess: () => {
      toast.success('Attendance saved successfully');
    },
    onSettled: () => {
      // Refetch in background to sync with server truth
      queryClient.invalidateQueries({ queryKey: queryKeys.allAttendance });
      queryClient.invalidateQueries({ queryKey: queryKeys.allAttendanceSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.allClassAttendance });
    },
  });
}
