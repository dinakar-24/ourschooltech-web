import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Image, Trash2, Loader2, Eye, EyeOff, Calendar, ImageIcon,
} from 'lucide-react';
import {
  useGalleryAlbums, useCreateAlbum, useUpdateAlbum, useDeleteAlbum, GalleryAlbum,
} from '@/hooks/useGallery';
import { AlbumDetailView } from '@/components/gallery/AlbumDetailView';
import { format } from 'date-fns';

export default function GalleryPage() {
  const { data: albums, isLoading } = useGalleryAlbums();
  const createAlbum = useCreateAlbum();
  const updateAlbum = useUpdateAlbum();
  const deleteAlbum = useDeleteAlbum();

  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteAlbumId, setDeleteAlbumId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', event_date: '' });

  const handleCreate = async () => {
    if (!formData.title) return;
    await createAlbum.mutateAsync({
      title: formData.title,
      description: formData.description || undefined,
      event_date: formData.event_date || undefined,
    });
    setIsCreateOpen(false);
    setFormData({ title: '', description: '', event_date: '' });
  };

  const handleTogglePublish = async (album: GalleryAlbum) => {
    await updateAlbum.mutateAsync({ id: album.id, is_published: !album.is_published });
  };

  if (selectedAlbum) {
    return (
        <AlbumDetailView album={selectedAlbum} onBack={() => setSelectedAlbum(null)} />
    );
  }

  return (
    <>
      <div className="space-y-5 animate-fade-up">
        {/* Header */}
        <div className="flex justify-between items-center gap-3">
          <p className="text-sm text-muted-foreground hidden sm:block">Manage photo and video albums</p>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> New Album</Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md rounded-xl">
              <DialogHeader><DialogTitle>Create Album</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Title</Label>
                  <Input placeholder="e.g. Annual Day 2025" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Description <span className="text-muted-foreground">(Optional)</span></Label>
                  <Textarea placeholder="Brief description..." rows={3} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Event Date <span className="text-muted-foreground">(Optional)</span></Label>
                  <Input type="date" value={formData.event_date} onChange={e => setFormData(p => ({ ...p, event_date: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createAlbum.isPending || !formData.title}>
                  {createAlbum.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Album
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Album grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : albums?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ImageIcon className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-foreground">No albums yet</p>
            <p className="text-sm mt-1">Create your first album to share school memories</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums?.map((album) => (
              <Card
                key={album.id}
                className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all duration-200 border-border/60"
                onClick={() => setSelectedAlbum(album)}
              >
                <div className="relative h-36 sm:h-44 bg-muted overflow-hidden">
                  {album.cover_image_url ? (
                    <img
                      src={album.cover_image_url}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                      <Image className="w-10 h-10 text-muted-foreground/25" />
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 bg-white/80 hover:bg-white backdrop-blur-sm shadow-sm"
                      onClick={() => handleTogglePublish(album)}
                    >
                      {album.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 bg-white/80 hover:bg-red-50 hover:text-destructive backdrop-blur-sm shadow-sm"
                      onClick={() => setDeleteAlbumId(album.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {/* Status badge overlay */}
                  <div className="absolute bottom-2 left-2">
                    <Badge
                      variant={album.is_published ? 'default' : 'outline'}
                      className={album.is_published
                        ? 'bg-green-500/90 hover:bg-green-500/90 text-white text-[10px] backdrop-blur-sm'
                        : 'bg-white/80 text-foreground text-[10px] backdrop-blur-sm border-none'
                      }
                    >
                      {album.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-3 sm:p-4">
                  <h3 className="font-semibold text-sm truncate">{album.title}</h3>
                  {album.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{album.description}</p>
                  )}
                  {album.event_date && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {format(new Date(album.event_date), 'dd MMM yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteAlbumId} onOpenChange={() => setDeleteAlbumId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Album?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the album and all its photos/videos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteAlbumId) { deleteAlbum.mutate(deleteAlbumId); setDeleteAlbumId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
