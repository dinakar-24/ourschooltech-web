import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';

// Migrated from Supabase to GET /school/reports/stats. Was reading the
// legacy `fees` table (0 rows, confirmed unused — see the "assign initial
// fees" item in the migration status doc) for totalFeeCollected/
// totalFeePending; the server-side endpoint now derives those from
// Payment/FeeInvoice instead, same conventions as the fee-collection and
// pending-dues reports. Exported shape unchanged, so ReportsPage.tsx needs
// no edits.

interface ReportStats {
  totalStudents: number;
  totalTeachers: number;
  totalFeeCollected: number;
  totalFeePending: number;
  attendanceToday: { present: number; absent: number; total: number };
}

export function useSchoolReportStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['school-report-stats', schoolId],
    queryFn: async (): Promise<ReportStats> => {
      const { data } = await api.get<ReportStats>('/school/reports/stats');
      return data;
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}
