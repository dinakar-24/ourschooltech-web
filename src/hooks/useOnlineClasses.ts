import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

export interface OnlineClass {
  id: string;
  school_id: string;
  section_id: string;
  class_name: string | null;
  section: string | null;
  subject_id: string | null;
  subject: string | null;
  teacher_id: string;
  teacher: { id: string; full_name: string } | null;
  title: string;
  description: string | null;
  platform: string;
  meeting_url: string | null;
  meeting_id: string | null;
  password: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EligibleSection {
  id: string;
  name: string;
  classId: string;
  className: string;
}

export interface OnlineClassInput {
  section_id: string;
  subject_id: string | null;
  title: string;
  description?: string | null;
  platform: string;
  meeting_url?: string | null;
  meeting_id?: string | null;
  password?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status?: string;
}

// Admin: read-only, school-wide oversight (creation is teacher-only, see below).
export function useOnlineClasses(filters?: { status?: string; sectionId?: string }) {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['online-classes', schoolId, filters],
    queryFn: async () => {
      const { data } = await api.get('/school/online-classes', { params: filters });
      return data.onlineClasses as OnlineClass[];
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Teacher: own scheduled classes (server-scoped to their own teacherId).
export function useTeacherOnlineClasses() {
  return useQuery({
    queryKey: ['teacher-online-classes'],
    queryFn: async () => {
      const { data } = await api.get('/teacher/online-classes');
      return data.onlineClasses as OnlineClass[];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Sections this teacher may schedule an online class for -- feeds the
 * create form's picker so an ineligible section never shows up to pick,
 * rather than 403ing on submit. */
export function useTeacherEligibleSections() {
  return useQuery({
    queryKey: ['teacher-online-class-sections'],
    queryFn: async () => {
      const { data } = await api.get('/teacher/online-classes/sections');
      return data.sections as EligibleSection[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Student: own class's schedule, section resolved server-side. */
export function useMyOnlineClasses() {
  return useQuery({
    queryKey: ['my-online-classes'],
    queryFn: async () => {
      const { data } = await api.get('/student/online-classes');
      return data.onlineClasses as OnlineClass[];
    },
  });
}

/** Parent: a specific child's class schedule (ownership-checked server-side). */
export function useChildOnlineClasses(studentId?: string) {
  return useQuery({
    queryKey: ['child-online-classes', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/parent/online-classes/${studentId}`);
      return data.onlineClasses as OnlineClass[];
    },
    enabled: !!studentId,
  });
}

export function useCreateOnlineClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: OnlineClassInput) => {
      const { data: res } = await api.post('/teacher/online-classes', data);
      return res.onlineClass as OnlineClass;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-online-classes'] });
      queryClient.invalidateQueries({ queryKey: ['online-classes'] });
      toast.success('Online class scheduled');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to schedule class'),
  });
}

export function useUpdateOnlineClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<OnlineClassInput> & { id: string }) => {
      const { data: res } = await api.put(`/teacher/online-classes/${id}`, data);
      return res.onlineClass as OnlineClass;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-online-classes'] });
      queryClient.invalidateQueries({ queryKey: ['online-classes'] });
      toast.success('Online class updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to update class'),
  });
}

export function useDeleteOnlineClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/teacher/online-classes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-online-classes'] });
      queryClient.invalidateQueries({ queryKey: ['online-classes'] });
      toast.success('Online class deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to delete class'),
  });
}
