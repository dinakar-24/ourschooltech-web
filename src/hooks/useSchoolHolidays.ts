import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

export interface SchoolHoliday {
  id: string;
  school_id: string;
  title: string;
  date: string;
  event_type: string;
  created_at: string;
}

export function useSchoolHolidays(month?: number, year?: number) {
  const schoolId = useEffectiveSchoolId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['school-holidays', schoolId, month, year],
    queryFn: async () => {
      const { data } = await api.get('/school/holidays', {
        params: month !== undefined && year !== undefined ? { month, year } : undefined,
      });
      return data.holidays as SchoolHoliday[];
    },
    enabled: !!schoolId,
  });

  const addHoliday = useMutation({
    mutationFn: async ({ title, date, event_type }: { title: string; date: string; event_type: string }) => {
      await api.post('/school/holidays', { title, date, event_type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-holidays'] });
      toast.success('Holiday added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });

  const deleteHoliday = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/school/holidays/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-holidays'] });
      toast.success('Holiday removed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });

  return { ...query, addHoliday, deleteHoliday };
}
