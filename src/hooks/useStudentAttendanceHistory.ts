import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
}

interface RawAttendance {
  date: string;
  status: string;
}

const STATUS_MAP: Record<string, AttendanceRecord['status']> = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  HALF_DAY: 'half_day',
};

export function useStudentAttendanceHistory(studentId?: string) {
  const { user } = useAuth();
  const role = user?.role;

  return useQuery({
    queryKey: ['student-attendance-history', studentId, role],
    queryFn: async (): Promise<{ records: AttendanceRecord[]; percentage: number }> => {
      const url = role === 'student'
        ? '/student/attendance/history'
        : `/parent/attendance/${studentId}/history`;
      const { data } = await api.get<{ attendance: RawAttendance[] }>(url);

      const records: AttendanceRecord[] = data.attendance.map(r => ({
        date: r.date,
        status: STATUS_MAP[r.status] ?? 'absent',
      }));

      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const halfDay = records.filter(r => r.status === 'half_day').length;
      const percentage = total > 0 ? Math.round(((present + late + halfDay * 0.5) / total) * 100 * 10) / 10 : 0;

      return { records, percentage };
    },
    enabled: !!studentId && !!role,
    staleTime: 5 * 60 * 1000,
  });
}
