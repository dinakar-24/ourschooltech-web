import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Upload, Trash2, ImageIcon, ZoomIn, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TimetableImageUploadProps {
  schoolId: string;
  selectedClass: string;
  selectedSection: string;
}

interface TimetableImage {
  id: string;
  image_url: string;
  updated_at: string;
}

export function TimetableImageUpload({ schoolId, selectedClass, selectedSection }: TimetableImageUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // DB metadata (the pointer row) lives on Express now; the actual file
  // stays in Supabase Storage's "timetables" bucket — unaffected by the
  // Auth/DB migration, same pattern as every other upload in this app.
  const { data: timetableImage, isLoading: loadingImage } = useQuery({
    queryKey: ['timetable-image', schoolId, selectedClass, selectedSection],
    queryFn: async (): Promise<TimetableImage | null> => {
      const { data } = await api.get('/school/timetable-images', {
        params: { className: selectedClass, section: selectedSection },
      });
      if (!data.image) return null;
      return { id: data.image.id, image_url: data.image.imageUrl, updated_at: data.image.updatedAt };
    },
    enabled: !!schoolId && !!selectedClass,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!schoolId || !selectedClass) throw new Error('Select a class first');
      const ext = file.name.split('.').pop();
      const path = `${schoolId}/${selectedClass}-${selectedSection}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('timetables').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('timetables').getPublicUrl(path);
      const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await api.post('/school/timetable-images', { className: selectedClass, section: selectedSection, imageUrl });
      return imageUrl;
    },
    onSuccess: () => { toast.success('Timetable uploaded'); queryClient.invalidateQueries({ queryKey: ['timetable-image'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || err.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId || !selectedClass || !timetableImage) throw new Error('Nothing to delete');
      const { data: files } = await supabase.storage.from('timetables').list(schoolId, { search: `${selectedClass}-${selectedSection}` });
      if (files?.length) await supabase.storage.from('timetables').remove(files.map(f => `${schoolId}/${f.name}`));
      await api.delete(`/school/timetable-images/${timetableImage.id}`);
    },
    onSuccess: () => { toast.success('Timetable removed'); queryClient.invalidateQueries({ queryKey: ['timetable-image'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error || err.message || 'Delete failed'),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File size must be under 10MB'); return; }
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  if (!selectedClass) {
    return (
      <Card className="p-12 text-center">
        <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Select a Class</h3>
        <p className="text-muted-foreground text-sm">Choose a class and section to view or upload the timetable image.</p>
      </Card>
    );
  }

  if (loadingImage) {
    return <Card className="p-12 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" /></Card>;
  }

  return (
    <>
      {timetableImage ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative group">
              <img src={(timetableImage as any).image_url} alt={`Timetable for ${selectedClass} - Section ${selectedSection}`} className="w-full h-auto cursor-pointer" onClick={() => setShowFullscreen(true)} />
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="secondary" className="shadow-lg h-9 w-9" onClick={() => setShowFullscreen(true)}><ZoomIn className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between border-t">
              <div>
                <p className="font-semibold text-sm">{selectedClass} - Section {selectedSection}</p>
                <p className="text-xs text-muted-foreground">Updated {new Date((timetableImage as any).updated_at).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}Replace
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => fileInputRef.current?.click()}>
          <CardContent className="p-10 text-center">
            {isUploading ? (
              <><Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" /><h3 className="text-lg font-semibold mb-1">Uploading...</h3></>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><ImageIcon className="w-8 h-8 text-primary" /></div>
                <h3 className="text-lg font-semibold mb-1">Upload Timetable</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload a photo or image of the timetable for {selectedClass} - Section {selectedSection}</p>
                <Button size="sm" variant="outline" className="pointer-events-none"><Upload className="w-4 h-4 mr-2" />Choose Image</Button>
                <p className="text-xs text-muted-foreground mt-3">Supports JPG, PNG, WebP • Max 10MB</p>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-auto">
          <button onClick={() => setShowFullscreen(false)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-lg"><X className="w-4 h-4" /></button>
          {timetableImage && <img src={(timetableImage as any).image_url} alt="Timetable" className="w-full h-auto" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
