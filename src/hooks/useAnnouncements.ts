import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase to /api/school/announcements. Full CRUD deferred
// from the Teacher/Student batch — that batch only wired up the read-only
// student path (useStudentAnnouncements in useStudentData.ts), which is
// untouched here.
//
// target_roles is now genuinely array-valued server-side too (Prisma
// `targetRoles Role[]`), replacing the old single nullable `targetRole`
// enum — the parent/teacher/student announcement-read routes were updated
// to match (`targetRoles: { isEmpty: true } OR { has: 'X' }`, same "empty =
// broadcast to everyone" convention the old target_classes filtering used).
//
// target_classes is DROPPED, not ported: AnnouncementsPage.tsx never had a
// UI control for it despite the old types declaring it — there was nothing
// real to migrate.
//
// image_url persists through the renamed `imageUrl` column (was the unused
// `attachment` field). The upload step itself stays on Supabase Storage —
// same precedent as AvatarUpload, which already proved Storage still works
// independent of Supabase Auth post-migration.
//
// The notification fan-out on publish is now done server-side
// (announcement.controller.js), off User.role/schoolId directly — the old
// client-side chain through `user_roles` + `profiles` doesn't exist in this
// schema. Nothing left to do here on success beyond toast + invalidate.
// ─────────────────────────────────────────────────────────────────────────

export type AppRole = 'super_admin' | 'school_admin' | 'teacher' | 'parent' | 'student';

// Exported for reuse by useSystemAnnouncements.ts (same Role enum, same
// lowercase-frontend/uppercase-API split, different model).
export const ROLE_TO_API: Record<AppRole, string> = {
  super_admin: 'SUPER_ADMIN',
  school_admin: 'SCHOOL_ADMIN',
  teacher: 'TEACHER',
  parent: 'PARENT',
  student: 'STUDENT',
};

export const ROLE_FROM_API: Record<string, AppRole> = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  PARENT: 'parent',
  STUDENT: 'student',
};

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  expires_at: string | null;
  target_roles: AppRole[] | null;
  created_by: string | null;
  created_at: string;
  school_id: string;
  image_url: string | null;
}

export interface AnnouncementFormData {
  title: string;
  content: string;
  target_roles: AppRole[];
  expires_at?: string;
  is_active: boolean;
  image_url?: string | null;
}

interface AnnouncementFilters {
  status?: 'active' | 'inactive' | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedAnnouncements {
  data: Announcement[];
  totalCount: number;
}

/** Raw shape of an announcement row from the Express API */
interface RawAnnouncement {
  id: string;
  schoolId: string;
  title: string;
  content: string;
  targetRoles: string[];
  imageUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

function mapAnnouncement(raw: RawAnnouncement): Announcement {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    is_active: raw.isActive,
    expires_at: raw.expiresAt,
    target_roles: raw.targetRoles.map(r => ROLE_FROM_API[r]).filter(Boolean),
    created_by: raw.createdBy,
    created_at: raw.createdAt,
    school_id: raw.schoolId,
    image_url: raw.imageUrl,
  };
}

export function useAnnouncements(filters?: AnnouncementFilters) {
  const schoolId = useEffectiveSchoolId();
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;

  return useQuery({
    queryKey: queryKeys.announcements(schoolId, filters),
    queryFn: async (): Promise<PaginatedAnnouncements> => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get<{ announcements: RawAnnouncement[]; total: number }>('/school/announcements', {
        params: {
          page,
          pageSize,
          status: filters?.status && filters.status !== 'all' ? filters.status : undefined,
          search: filters?.search || undefined,
        },
      });

      return { data: data.announcements.map(mapAnnouncement), totalCount: data.total };
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAnnouncementStats() {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: queryKeys.announcementStats(schoolId),
    queryFn: async () => {
      if (!schoolId) throw new Error('No school ID');

      const { data } = await api.get<{ total: number; active: number; inactive: number; thisMonth: number }>('/school/announcements/stats');
      return data;
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

function toApiPayload(formData: Partial<AnnouncementFormData>) {
  return {
    ...(formData.title !== undefined && { title: formData.title }),
    ...(formData.content !== undefined && { content: formData.content }),
    ...(formData.target_roles !== undefined && { targetRoles: formData.target_roles.map(r => ROLE_TO_API[r]) }),
    ...(formData.expires_at !== undefined && { expiresAt: formData.expires_at || null }),
    ...(formData.image_url !== undefined && { imageUrl: formData.image_url }),
    ...(formData.is_active !== undefined && { isActive: formData.is_active }),
  };
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: AnnouncementFormData) => {
      const { data } = await api.post<{ announcement: RawAnnouncement }>('/school/announcements', toApiPayload(formData));
      return mapAnnouncement(data.announcement);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncements });
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncementStats });
      toast.success(variables.is_active ? 'Announcement published!' : 'Announcement saved as draft');
    },
    // Global mutation error handler provides fallback toast
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<AnnouncementFormData> & { id: string }) => {
      const { data } = await api.patch<{ announcement: RawAnnouncement }>(`/school/announcements/${id}`, toApiPayload(formData));
      return mapAnnouncement(data.announcement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncements });
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncementStats });
      toast.success('Announcement updated');
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      await api.delete(`/school/announcements/${announcementId}`);
    },
    // Optimistic: remove from cache immediately
    onMutate: async (announcementId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.allAnnouncements });
      const previousQueries = queryClient.getQueriesData({ queryKey: queryKeys.allAnnouncements });
      previousQueries.forEach(([key, data]: [any, any]) => {
        if (data?.data && Array.isArray(data.data)) {
          queryClient.setQueryData(key, {
            ...data,
            data: data.data.filter((a: any) => a.id !== announcementId),
            totalCount: Math.max(0, (data.totalCount || 0) - 1),
          });
        }
      });
      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncements });
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncementStats });
      toast.success('Announcement deleted');
    },
  });
}

export function useToggleAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/school/announcements/${id}/toggle`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncements });
      queryClient.invalidateQueries({ queryKey: queryKeys.allAnnouncementStats });
      toast.success(variables.isActive ? 'Announcement published' : 'Announcement unpublished');
    },
  });
}
