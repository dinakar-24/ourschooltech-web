import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from './useEffectiveSchoolId';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TransportRoute {
  id: string;
  school_id: string;
  route_name: string;
  route_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_number: string | null;
  capacity: number;
  start_location: string | null;
  end_location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentTransport {
  id: string;
  student_id: string;
  route_id: string;
  school_id: string;
  pickup_stop: string | null;
  drop_stop: string | null;
  boarding_type: string;
  created_at: string;
  student?: { full_name: string; class_name: string; section: string; admission_number: string };
  route?: TransportRoute;
}

export function useTransportRoutes() {
  const schoolId = useEffectiveSchoolId();
  return useQuery({
    queryKey: ['transport-routes', schoolId],
    queryFn: async () => {
      const { data } = await api.get('/school/transport/routes');
      return data.routes as TransportRoute[];
    },
    enabled: !!schoolId,
    staleTime: 10 * 60 * 1000, // Transport routes rarely change
  });
}

// Admin view (optionally filtered by route) vs. a student's own assignment
// are different endpoints server-side (no RLS to fall back on), so this
// picks the right one by role. Called with no routeId for the student's own
// "My Transport" page, matching the old single-hook call site unchanged.
export function useStudentTransport(routeId?: string) {
  const schoolId = useEffectiveSchoolId();
  const { user } = useAuth();
  const role = user?.role;

  return useQuery({
    queryKey: ['student-transport', schoolId, role, routeId],
    queryFn: async () => {
      if (role === 'student') {
        const { data } = await api.get('/student/transport');
        return data.transport as StudentTransport[];
      }
      const { data } = await api.get('/school/transport/assignments', {
        params: routeId ? { routeId } : undefined,
      });
      return data.assignments as StudentTransport[];
    },
    enabled: !!schoolId && !!role,
    staleTime: 5 * 60 * 1000,
  });
}

// Parent's own child's assignment — separate from useStudentTransport since
// the endpoint needs an explicit studentId (same pattern as useParentInvoices
// etc.: the page supplies childProfile.id from useParentChild()/useParentData()).
export function useParentTransport(studentId?: string) {
  return useQuery({
    queryKey: ['parent-transport', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/parent/transport/${studentId}`);
      return data.transport as StudentTransport[];
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (route: Partial<TransportRoute>) => {
      const { data } = await api.post('/school/transport/routes', route);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route created'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<TransportRoute> & { id: string }) => {
      const { data } = await api.put(`/school/transport/routes/${id}`, rest);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/school/transport/routes/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); toast.success('Route deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useAssignStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { student_id: string; route_id: string; school_id: string; pickup_stop?: string; drop_stop?: string; boarding_type?: string }) => {
      await api.post('/school/transport/assignments', data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-transport'] }); toast.success('Student assigned to route'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useRemoveStudentTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/school/transport/assignments/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student-transport'] }); toast.success('Student removed from route'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}
