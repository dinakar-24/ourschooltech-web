import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadToR2 } from '@/lib/uploads';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from a flat Gallery table to GalleryAlbum + GalleryItem via
// /api/gallery. File bytes still go straight to Supabase Storage — that's
// unaffected by the S3 migration (same already-validated pattern as
// avatar uploads across Parent/Teacher/Student) — only the DB metadata
// (album/item rows) moved to Express.
//
// Same tenant-leak risk class as useSupportQueries.ts/useFeedback.ts, even
// though the original code never called it out: useGalleryAlbums took a
// client-supplied `publishedOnly` boolean. A parent crafting
// publishedOnly=false could have seen unpublished/draft albums. The
// Express endpoint ignores that param for non-admins and always forces
// published-only server-side; admins can still optionally filter.
//
// AlbumDetailView.tsx (the only component with upload/delete UI) is
// admin-only — ParentGallery.tsx has its own separate, genuinely read-only
// rendering and never imports it.
//
// The old client-side "set/clear cover image" bookkeeping in
// useUploadGalleryItem/useDeleteGalleryItem now happens server-side in one
// request each — simpler hooks, same behavior.
// ─────────────────────────────────────────────────────────────────────────

export interface GalleryAlbum {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  event_date: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface GalleryItem {
  id: string;
  album_id: string;
  school_id: string;
  file_url: string;
  file_type: string;
  caption: string | null;
  display_order: number;
  uploaded_by: string | null;
  created_at: string;
}

interface RawGalleryAlbum {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  eventDate: string | null;
  isPublished: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawGalleryItem {
  id: string;
  albumId: string;
  schoolId: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
  displayOrder: number;
  uploadedBy: string | null;
  createdAt: string;
}

const FILE_TYPE_TO_API: Record<string, string> = { image: 'IMAGE', video: 'VIDEO' };
const FILE_TYPE_FROM_API: Record<string, string> = { IMAGE: 'image', VIDEO: 'video' };

function mapAlbum(raw: RawGalleryAlbum): GalleryAlbum {
  return {
    id: raw.id,
    school_id: raw.schoolId,
    title: raw.title,
    description: raw.description,
    cover_image_url: raw.coverImageUrl,
    event_date: raw.eventDate,
    is_published: raw.isPublished,
    created_by: raw.createdBy,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

function mapItem(raw: RawGalleryItem): GalleryItem {
  return {
    id: raw.id,
    album_id: raw.albumId,
    school_id: raw.schoolId,
    file_url: raw.fileUrl,
    file_type: FILE_TYPE_FROM_API[raw.fileType] ?? raw.fileType.toLowerCase(),
    caption: raw.caption,
    display_order: raw.displayOrder,
    uploaded_by: raw.uploadedBy,
    created_at: raw.createdAt,
  };
}

export function useGalleryAlbums(publishedOnly = false) {
  const schoolId = useEffectiveSchoolId();

  return useQuery({
    queryKey: ['gallery-albums', schoolId, publishedOnly],
    queryFn: async () => {
      const { data } = await api.get<{ albums: RawGalleryAlbum[] }>('/gallery/albums', {
        params: { publishedOnly: publishedOnly ? 'true' : undefined },
      });
      return data.albums.map(mapAlbum);
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGalleryItems(albumId?: string) {
  return useQuery({
    queryKey: ['gallery-items', albumId],
    queryFn: async () => {
      if (!albumId) return [];
      const { data } = await api.get<{ items: RawGalleryItem[] }>(`/gallery/albums/${albumId}/items`);
      return data.items.map(mapItem);
    },
    enabled: !!albumId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; description?: string; event_date?: string; is_published?: boolean }) => {
      const { data: res } = await api.post('/gallery/albums', {
        title: data.title,
        description: data.description,
        eventDate: data.event_date,
        isPublished: data.is_published,
      });
      return res.album;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-albums'] });
      toast.success('Album created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useUpdateAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; event_date?: string; is_published?: boolean; cover_image_url?: string }) => {
      await api.patch(`/gallery/albums/${id}`, {
        title: data.title,
        description: data.description,
        eventDate: data.event_date,
        isPublished: data.is_published,
        coverImageUrl: data.cover_image_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-albums'] });
      toast.success('Album updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useDeleteAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/gallery/albums/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-albums'] });
      toast.success('Album deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}

export function useUploadGalleryItem() {
  const queryClient = useQueryClient();
  const schoolId = useEffectiveSchoolId();

  return useMutation({
    mutationFn: async ({ albumId, file, caption }: { albumId: string; file: File; caption?: string }) => {
      if (!schoolId) throw new Error('No school ID');

      // File validation
      const ALLOWED_TYPES = new Set([
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm',
      ]);
      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error('Only JPEG, PNG, WebP, GIF images and MP4/WebM videos are allowed');
      }
      const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File too large. Max ${file.type.startsWith('video/') ? '50' : '10'}MB`);
      }
      if (file.size === 0) {
        throw new Error('File is empty');
      }

      // Secure filename with UUID (prevents path traversal).
      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      const key = `gallery/${schoolId}/${albumId}/${crypto.randomUUID()}.${ext}`;
      const { url } = await uploadToR2(key, file, file.type);
      const apiFileType = FILE_TYPE_TO_API[file.type.startsWith('video/') ? 'video' : 'image'];

      // DB row + "set as cover if first item" now happen server-side in one call.
      await api.post(`/gallery/albums/${albumId}/items`, {
        fileUrl: url,
        fileType: apiFileType,
        caption: caption || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-items'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-albums'] });
      toast.success('File uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; albumId: string; fileUrl?: string }) => {
      // Cover-image bookkeeping now happens server-side.
      await api.delete(`/gallery/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-items'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-albums'] });
      toast.success('Item deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e.message),
  });
}
