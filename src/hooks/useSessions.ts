import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getRefreshToken } from '@/stores/authStore';

// Device/session management (Part D, Pass B). One row per logged-in
// device -- refresh() rotates a session's token value on every use but
// keeps the same underlying row, so this stays a stable "your devices"
// list rather than growing one entry per refresh.
export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<Session[]> => {
      // Sent as a header, not a query param -- the backend only compares
      // it server-side to flag which row is "this device," never logs or
      // echoes it back. See getSessions()'s own comment for why a header
      // over a query string.
      const { data } = await api.get('/auth/sessions', {
        headers: { 'X-Refresh-Token': getRefreshToken() || '' },
      });
      return data.sessions;
    },
    staleTime: 30 * 1000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session signed out');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to revoke session');
    },
  });
}

// No onSuccess toast/invalidation here deliberately -- logging out
// everywhere ends the caller's own session too, so the component calling
// this is responsible for clearing local state and navigating away, not
// for refetching a session list that no longer applies to anyone.
export function useLogoutAll() {
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout-all');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to log out everywhere');
    },
  });
}
