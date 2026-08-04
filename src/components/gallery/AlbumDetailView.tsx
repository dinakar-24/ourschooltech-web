import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, Loader2, Image, Video, ImageIcon } from 'lucide-react';
import { useGalleryItems, useUploadGalleryItem, useDeleteGalleryItem, useUpdateAlbum, GalleryAlbum } from '@/hooks/useGallery';
import { ImageViewer } from './ImageViewer';
import { toast } from 'sonner';

interface AlbumDetailViewProps {
  album: GalleryAlbum;
  onBack: () => void;
}

export function AlbumDetailView({ album, onBack }: AlbumDetailViewProps) {
  const { data: items, isLoading } = useGalleryItems(album.id);
  const uploadItem = useUploadGalleryItem();
  const deleteItem = useDeleteGalleryItem();
  const updateAlbum = useUpdateAlbum();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [coverUrl, setCoverUrl] = useState(album.cover_image_url);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) continue;
      await uploadItem.mutateAsync({ albumId: album.id, file });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSetThumbnail = async (fileUrl: string) => {
    try {
      await updateAlbum.mutateAsync({ id: album.id, cover_image_url: fileUrl });
      setCoverUrl(fileUrl);
      toast.success('Album thumbnail updated');
    } catch {
      toast.error('Failed to update thumbnail');
    }
  };

  const openViewer = (idx: number) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <h2 className="text-sm font-semibold text-foreground truncate">{album.title}</h2>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadItem.isPending}>
            {uploadItem.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            Upload
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : items?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No photos yet</p>
          <p className="text-sm mt-1">Upload photos or videos to this album</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {items?.map((item, idx) => (
            <div
              key={item.id}
              className="relative group rounded-xl overflow-hidden border border-border bg-muted cursor-pointer aspect-square"
              onClick={() => openViewer(idx)}
            >
              {item.file_type === 'video' ? (
                <video src={item.file_url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={item.file_url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              )}
              {coverUrl === item.file_url && (
                <Badge className="absolute top-1.5 left-1.5 bg-primary/90 text-primary-foreground text-[9px] px-1.5 py-0.5">
                  Thumbnail
                </Badge>
              )}
              {item.file_type === 'video' && (
                <Badge className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5">
                  <Video className="w-3 h-3 mr-0.5" /> Video
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <ImageViewer
          items={items}
          initialIndex={viewerIndex}
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          onDelete={(id) => {
            const item = items.find(i => i.id === id);
            deleteItem.mutate({ id, albumId: album.id, fileUrl: item?.file_url });
            if (item?.file_url === coverUrl) setCoverUrl(null);
          }}
          onSetThumbnail={handleSetThumbnail}
          currentThumbnailUrl={coverUrl}
        />
      )}
    </div>
  );
}
