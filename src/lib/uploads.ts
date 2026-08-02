import { api } from '@/lib/api';

// Shared R2 upload helper -- replaces every direct supabase.storage.from(...)
// call across the app. Callers build the full object key themselves (e.g.
// "avatars/users/<uuid>.jpg", "platform-assets/logo.png") so each file's
// existing key-naming behavior (UUID-unique vs fixed-name-overwrite) stays
// exactly as it was under Supabase Storage -- only where the bytes go changed.

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL as string | undefined;

export async function uploadToR2(key: string, file: File | Blob, contentType: string): Promise<{ url: string | null; key: string }> {
  const { data } = await api.post('/uploads/presign', { key, contentType });
  const putResp = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  });
  if (!putResp.ok) throw new Error('Upload to storage failed');
  return { url: data.publicUrl, key: data.key };
}

export async function deleteFromR2(key: string): Promise<void> {
  await api.delete('/uploads', { params: { key } });
}

// Payment-proofs (private) viewing -- replaces supabase.storage.createSignedUrl.
export async function getSignedReadUrl(key: string): Promise<string> {
  const { data } = await api.get('/uploads/signed-read', { params: { key } });
  return data.url;
}

// Some flows only ever persisted the public URL (not the key) -- derive the
// key back out of it for delete calls, same shape as the old
// `url.split('/avatars/')[1]` trick this replaces.
export function keyFromPublicUrl(url: string): string | null {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) return null;
  // Strip any cache-busting query string (e.g. "?t=<timestamp>") some
  // flows append to the stored URL.
  return url.slice(R2_PUBLIC_URL.length + 1).split('?')[0];
}
