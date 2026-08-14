import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Admin-facing surface for Part D Phase 1's SchoolMembership model — see
// backend/src/controllers/superadmin.controller.js's getUserMemberships/
// grantMembership/revokeMembership. There's no self-service invite flow;
// a Super Admin grants/revokes access to an additional school by hand.

export interface SchoolMembership {
  id: string;
  userId: string;
  schoolId: string;
  role: 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
  isActive: boolean;
  createdAt: string;
  school: { id: string; name: string; subdomain: string };
}

export function useUserMemberships(userId: string | null) {
  return useQuery({
    queryKey: ['user-memberships', userId],
    queryFn: async (): Promise<SchoolMembership[]> => {
      const { data } = await api.get(`/superadmin/users/${userId}/memberships`);
      return data.memberships;
    },
    enabled: !!userId,
  });
}

export function useGrantMembership(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ schoolId, role }: { schoolId: string; role: string }) => {
      const { data } = await api.post(`/superadmin/users/${userId}/memberships`, { schoolId, role });
      return data.membership;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-memberships', userId] });
      toast.success('School access granted');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to grant school access');
    },
  });
}

export function useRevokeMembership(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schoolId: string) => {
      await api.delete(`/superadmin/users/${userId}/memberships/${schoolId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-memberships', userId] });
      toast.success('School access revoked');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to revoke school access');
    },
  });
}
