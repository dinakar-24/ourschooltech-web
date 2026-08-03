import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

interface RawAcademicYear {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
}

function mapYear(raw: RawAcademicYear): AcademicYear {
  return {
    id: raw.id,
    school_id: raw.schoolId,
    name: raw.name,
    start_date: raw.startDate,
    end_date: raw.endDate,
    is_current: raw.isCurrent,
    created_at: raw.createdAt,
    // AcademicYear has no updatedAt column — created_at stands in, unused
    // by AcademicYearsPage.tsx's UI anyway.
    updated_at: raw.createdAt,
  };
}

export function useAcademicYears() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['academic-years', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ years: RawAcademicYear[] }>('/school/academic-years');
      return data.years.map(mapYear);
    },
    enabled: !!schoolId,
  });
}

export function useCurrentAcademicYear() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['current-academic-year', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ years: RawAcademicYear[] }>('/school/academic-years');
      const current = data.years.find(y => y.isCurrent);
      return current ? mapYear(current) : null;
    },
    enabled: !!schoolId,
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, startDate, endDate, isCurrent }: {
      name: string;
      startDate: string;
      endDate: string;
      isCurrent?: boolean;
    }) => {
      const { data } = await api.post('/school/academic-years', { name, startDate, endDate, isCurrent });
      return data.year;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['current-academic-year'] });
      toast.success('Academic year created successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create academic year');
    },
  });
}

export function useSetCurrentAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (yearId: string) => {
      const { data } = await api.patch(`/school/academic-years/${yearId}/set-current`);
      return data.year;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['current-academic-year'] });
      toast.success('Current academic year updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update academic year');
    },
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, startDate, endDate }: {
      id: string;
      name: string;
      startDate: string;
      endDate: string;
    }) => {
      const { data } = await api.patch(`/school/academic-years/${id}`, { name, startDate, endDate });
      return data.year;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['current-academic-year'] });
      toast.success('Academic year updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update academic year');
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/school/academic-years/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['current-academic-year'] });
      toast.success('Academic year deleted');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete academic year');
    },
  });
}
