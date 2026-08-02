import { useState, useRef } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  BookOpen,
  Calendar,
  Eye,
  Edit,
  Users,
  Loader2,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { useClasses } from '@/hooks/useClasses';
import { useTeacherHomework, useCreateHomework } from '@/hooks/useHomework';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { uploadToR2 } from '@/lib/uploads';
import { toast } from 'sonner';

const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Social Studies', 'Computer Science'];

export default function TeacherHomework() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: classes } = useClasses();
  const { data: homework, isLoading } = useTeacherHomework();
  const createHomework = useCreateHomework();

  const selectedClass = classes?.find(c => c.id === selectedClassId);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 5) {
      toast.error('Maximum 5 photos allowed');
      return;
    }
    const validFiles = files.filter(f => {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });
    setPhotos(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const photo of photos) {
      const ext = photo.name.split('.').pop();
      const key = `avatars/homework/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      try {
        const { url } = await uploadToR2(key, photo, photo.type);
        if (url) urls.push(url);
      } catch (err) {
        console.error('Upload error:', err);
        continue;
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!selectedClassId || !selectedSubject || !title || !dueDate) return;

    setUploading(true);
    try {
      let attachments: string[] | undefined;
      if (photos.length > 0) {
        attachments = await uploadPhotos();
      }

      await createHomework.mutateAsync({
        class_id: selectedClassId,
        section_id: selectedSectionId || undefined,
        subject: selectedSubject,
        title,
        description: description || undefined,
        due_date: dueDate,
        attachments,
      });

      setSelectedClassId('');
      setSelectedSectionId('');
      setSelectedSubject('');
      setTitle('');
      setDescription('');
      setDueDate('');
      setPhotos([]);
      setPhotoPreviews([]);
      setIsAddDialogOpen(false);
    } catch {
      // error handled in hook
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) return <Badge variant="secondary">Completed</Badge>;
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <MobileLayout title="Homework" showBack>
      <div className="p-4 space-y-4">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Post New Homework
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Post Homework</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedSectionId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                    <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                    <SelectContent>
                      {selectedClass?.sections.map(sec => (
                        <SelectItem key={sec.id} value={sec.id}>Section {sec.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input placeholder="e.g., Chapter 5 Exercises" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Describe the homework..." className="min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              {/* Photo Attachments */}
              <div className="space-y-2">
                <Label>Photos (Max 5)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photoPreviews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={preview} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {photos.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Add Photos
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createHomework.isPending || uploading || !selectedClassId || !selectedSubject || !title || !dueDate}
              >
                {(createHomework.isPending || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Homework List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : homework?.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Homework Posted</h3>
            <p className="text-muted-foreground">Post your first homework assignment.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {homework?.map((hw) => (
              <Card key={hw.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{hw.class?.name}</p>
                        <p className="text-xs text-muted-foreground">{hw.subject} {hw.section && `• Section ${hw.section.name}`}</p>
                      </div>
                    </div>
                    {getStatusBadge(hw.due_date)}
                  </div>
                  <h3 className="font-semibold mb-1">{hw.title}</h3>
                  {hw.description && <p className="text-sm text-muted-foreground mb-2">{hw.description}</p>}

                  {/* Attached Photos */}
                  {hw.attachments && hw.attachments.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {hw.attachments.map((url, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due: {format(new Date(hw.due_date), 'dd MMM yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Posted {format(new Date(hw.created_at), 'dd MMM')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1"><Eye className="w-4 h-4 mr-2" />View</Button>
                    <Button variant="outline" size="sm" className="flex-1"><Edit className="w-4 h-4 mr-2" />Edit</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
