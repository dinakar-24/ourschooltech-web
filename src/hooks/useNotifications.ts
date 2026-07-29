import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to GET/PATCH /api/notifications.
//
// The exported `Notification` shape and the ['notifications', user.id] query
// key are unchanged, so NotificationsPage and the bell need no edits — the
// snake_case field names below are mapped from the API's camelCase.
//
// The Supabase Realtime subscription this used for live inbox updates was
// REMOVED, not ported: Express has no `postgres_changes` equivalent, and with
// no Supabase session the listener could never fire again. Replaced with a
// 60s poll. Revisit with SSE/WebSockets if the latency becomes a problem.
// ─────────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  school_id: string | null;
  title: string;
  body: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

/** Raw row from GET /api/notifications */
interface RawNotification {
  id: string;
  userId: string;
  schoolId: string | null;
  title: string;
  body: string;
  type: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

function mapNotification(raw: RawNotification): Notification {
  return {
    id: raw.id,
    user_id: raw.userId,
    school_id: raw.schoolId,
    title: raw.title,
    body: raw.body,
    type: raw.type,
    reference_id: raw.referenceId,
    is_read: raw.isRead,
    created_at: raw.createdAt,
  };
}

const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async (): Promise<Notification[]> => {
      const { data } = await api.get('/notifications');
      return (data.notifications as RawNotification[]).map(mapNotification);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    // Stands in for the removed Realtime subscription.
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');
      await api.patch('/notifications/read-all');
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', user?.id] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications', user?.id]);
      queryClient.setQueryData<Notification[]>(['notifications', user?.id], (old) =>
        (old || []).map(n => ({ ...n, is_read: true }))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications', user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}
