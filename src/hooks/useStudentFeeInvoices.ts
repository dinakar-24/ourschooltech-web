import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { mapInvoice, type FeeInvoice, type RawInvoice } from './useFeeInvoices';
import { queryKeys } from '@/lib/query-keys';

export function useStudentFeeInvoices(studentId: string | undefined) {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.studentFeeInvoices(schoolId, studentId),
    queryFn: async () => {
      if (!schoolId || !studentId) return [] as FeeInvoice[];

      const { data } = await api.get('/school/fees/invoices', {
        params: { studentId, limit: 100 },
      });

      return (data.invoices as RawInvoice[]).map(mapInvoice);
    },
    enabled: !!schoolId && !!studentId,
    staleTime: 2 * 60 * 1000,
  });
}
