import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AppRole, ROLE_TO_API, ROLE_FROM_API } from '@/hooks/useAnnouncements';

// ─────────────────────────────────────────────────────────────────────────
// Platform-wide announcements (SystemAnnouncement, Super Admin only) --
// distinct from the tenant-scoped Announcement model behind
// useAnnouncements.ts. Migrated from raw supabase.from('system_announcements')
// calls to /api/superadmin/system-announcements. Reuses useAnnouncements.ts's
// AppRole/ROLE_TO_API/ROLE_FROM_API since target_roles here is the exact
// same Role enum with the exact same lowercase-frontend split.
// ─────────────────────────────────────────────────────────────────────────

export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

const PRIORITY_TO_API: Record<AnnouncementPriority, string> = {
  low: 'LOW',
  normal: 'NORMAL',
  high: 'HIGH',
  urgent: 'URGENT',
};

const PRIORITY_FROM_API: Record<string, AnnouncementPriority> = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  target_roles: AppRole[];
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface SystemAnnouncementFormData {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  target_roles: AppRole[];
  expires_at?: string;
  is_active?: boolean;
}

/** Raw shape of a row from the Express API */
interface RawSystemAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: string;
  targetRoles: string[];
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

function mapSystemAnnouncement(raw: RawSystemAnnouncement): SystemAnnouncement {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    priority: PRIORITY_FROM_API[raw.priority] || 'normal',
    target_roles: raw.targetRoles.map(r => ROLE_FROM_API[r]).filter(Boolean) as AppRole[],
    is_active: raw.isActive,
    expires_at: raw.expiresAt,
    created_at: raw.createdAt,
  };
}

function toApiPayload(formData: Partial<SystemAnnouncementFormData>) {
  return {
    ...(formData.title !== undefined && { title: formData.title }),
    ...(formData.content !== undefined && { content: formData.content }),
    ...(formData.priority !== undefined && { priority: PRIORITY_TO_API[formData.priority] }),
    ...(formData.target_roles !== undefined && { targetRoles: formData.target_roles.map(r => ROLE_TO_API[r]) }),
    ...(formData.expires_at !== undefined && { expiresAt: formData.expires_at || null }),
    ...(formData.is_active !== undefined && { isActive: formData.is_active }),
  };
}

const QUERY_KEY = ['system-announcements'];

export function useSystemAnnouncements() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ announcements: RawSystemAnnouncement[] }>('/superadmin/system-announcements');
      return data.announcements.map(mapSystemAnnouncement);
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateSystemAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: SystemAnnouncementFormData) => {
      const { data } = await api.post<{ announcement: RawSystemAnnouncement }>('/superadmin/system-announcements', toApiPayload(formData));
      return mapSystemAnnouncement(data.announcement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Announcement created successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to save announcement'),
  });
}

export function useUpdateSystemAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<SystemAnnouncementFormData> & { id: string }) => {
      const { data } = await api.patch<{ announcement: RawSystemAnnouncement }>(`/superadmin/system-announcements/${id}`, toApiPayload(formData));
      return mapSystemAnnouncement(data.announcement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Announcement updated successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to save announcement'),
  });
}

export function useToggleSystemAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/superadmin/system-announcements/${id}/toggle`, { isActive });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Announcement ${variables.isActive ? 'activated' : 'deactivated'}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to update announcement'),
  });
}

export function useDeleteSystemAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/superadmin/system-announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Announcement deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Failed to delete announcement'),
  });
}
