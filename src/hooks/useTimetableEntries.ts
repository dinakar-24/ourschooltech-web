import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface TimetableEntry {
  id: string;
  school_id: string;
  section_id: string;
  period_number: number;
  day_of_week: string;
  subject_id: string | null;
  subject: string;
  teacher_id: string | null;
  start_time: string;
  end_time: string;
  is_lunch: boolean;
  created_at: string;
  updated_at: string;
  teacher?: { id: string; full_name: string } | null;
}

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Real FeeInvoiceItem-style FK -- takes a sectionId, not class/section name strings. */
export function useTimetableEntries(sectionId: string | undefined) {
  return useQuery({
    queryKey: ['timetable-entries', sectionId],
    queryFn: async (): Promise<TimetableEntry[]> => {
      const { data } = await api.get('/school/timetable', { params: { sectionId } });
      return data.entries as TimetableEntry[];
    },
    enabled: !!sectionId,
  });
}

/** Student: own class's schedule, section resolved server-side. */
export function useMyTimetable() {
  return useQuery({
    queryKey: ['my-timetable'],
    queryFn: async (): Promise<TimetableEntry[]> => {
      const { data } = await api.get('/student/timetable');
      return data.entries as TimetableEntry[];
    },
  });
}

export function useUpsertTimetableEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: {
      section_id: string;
      period_number: number;
      day_of_week: string;
      subject_id: string | null;
      teacher_id: string | null;
      start_time: string;
      end_time: string;
      is_lunch: boolean;
      apply_all_days?: boolean;
    }) => {
      const { data } = await api.post('/school/timetable', entry);
      return data.entries as TimetableEntry[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success('Timetable updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to update'),
  });
}

export function useDeleteTimetableEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/school/timetable/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      toast.success('Entry removed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to delete'),
  });
}
