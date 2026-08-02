import { useState } from 'react';
import { uploadToR2, deleteFromR2, keyFromPublicUrl } from '@/lib/uploads';
import { toast } from 'sonner';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function compressImage(file: File, maxSize = 200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else canvas.toBlob(
            (jpgBlob) => jpgBlob ? resolve(jpgBlob) : reject(new Error('Compression failed')),
            'image/jpeg', quality
          );
        },
        'image/webp', quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (file: File, folder: string = 'users'): Promise<string | null> => {
    try {
      setUploading(true);

      // Strict file type validation
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error('Only JPEG, PNG, WebP, and GIF images are allowed');
        return null;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image must be less than 5MB');
        return null;
      }
      if (file.size === 0) {
        toast.error('File is empty');
        return null;
      }

      // Compress & resize before uploading
      const compressed = await compressImage(file, 200, 0.8);
      const ext = compressed.type === 'image/webp' ? 'webp' : 'jpg';
      // Use crypto UUID for secure unique filename
      const key = `avatars/${folder}/${crypto.randomUUID()}.${ext}`;

      const { url } = await uploadToR2(key, compressed, compressed.type);
      return url;
    } catch (err: any) {
      toast.error('Failed to upload image');
      console.error('Avatar upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async (url: string): Promise<boolean> => {
    try {
      const key = keyFromPublicUrl(url);
      if (!key) return false;

      await deleteFromR2(key);
      return true;
    } catch (err) {
      console.error('Avatar delete error:', err);
      return false;
    }
  };

  return { uploadAvatar, deleteAvatar, uploading };
}
