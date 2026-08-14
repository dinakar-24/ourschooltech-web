import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Bell,
  Edit,
  Trash2,
  Send,
  Calendar,
  Users,
  Loader2,
  Megaphone,
  Eye,
  EyeOff,
  Search,
  ImagePlus,
  X,
} from 'lucide-react';
import { uploadToR2 } from '@/lib/uploads';
import {
  useAnnouncements,
  useAnnouncementStats,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useToggleAnnouncement,
  AnnouncementFormData,
  Announcement,
  AppRole,
} from '@/hooks/useAnnouncements';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { toast } from 'sonner';

const AVAILABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'teacher', label: 'Teachers' },
  { value: 'parent', label: 'Parents' },
  { value: 'student', label: 'Students' },
];

export default function AnnouncementsPage() {
  const pagination = usePagination(25);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    pagination.resetPage();
  }, [debouncedSearch, statusFilter]);

  const { data: announcementsResult, isLoading } = useAnnouncements({
    status: statusFilter,
    search: debouncedSearch,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const announcements = announcementsResult?.data || [];
  const totalCount = announcementsResult?.totalCount || 0;
  const { data: stats } = useAnnouncementStats();
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncementMutation = useDeleteAnnouncement();
  const toggleAnnouncement = useToggleAnnouncement();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    target_roles: [],
    expires_at: '',
    is_active: true,
    image_url: null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({ title: '', content: '', target_roles: [], expires_at: '', is_active: true, image_url: null });
    setImageFile(null);
    setImagePreview(null);
  };

  const toggleRole = (role: AppRole) => {
    setFormData(prev => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles, role]
    }));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.image_url || null;
    setUploadingImage(true);
    try {
      const ext = imageFile.name.split('.').pop();
      const key = `announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await uploadToR2(key, imageFile, imageFile.type);
      return url;
    } catch (err) {
      toast.error('Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async (publish: boolean) => {
    if (!formData.title || !formData.content || formData.target_roles.length === 0) return;
    const imageUrl = await uploadImage();
    await createAnnouncement.mutateAsync({ ...formData, is_active: publish, image_url: imageUrl });
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!selectedAnnouncement) return;
    const imageUrl = await uploadImage();
    await updateAnnouncement.mutateAsync({ id: selectedAnnouncement.id, ...formData, image_url: imageUrl });
    setIsEditDialogOpen(false);
    setSelectedAnnouncement(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!selectedAnnouncement) return;
    await deleteAnnouncementMutation.mutateAsync(selectedAnnouncement.id);
    setDeleteDialogOpen(false);
    setSelectedAnnouncement(null);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleAnnouncement.mutateAsync({ id, isActive: !isActive });
  };

  const openEditDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      target_roles: (announcement.target_roles || []) as AppRole[],
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
      is_active: announcement.is_active,
      image_url: announcement.image_url || null,
    });
    setImageFile(null);
    setImagePreview(announcement.image_url || null);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setDeleteDialogOpen(true);
  };

  const formFields = (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          placeholder="Enter announcement title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea
          placeholder="Enter announcement message..."
          className="min-h-[120px]"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
        />
      </div>
      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Photo (Optional)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        {imagePreview ? (
          <div className="relative w-full max-w-xs">
            <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-border" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={removeImage}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full max-w-xs h-24 border-dashed flex flex-col gap-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Click to add image</span>
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Expires On (Optional)</Label>
          <Input
            type="date"
            value={formData.expires_at}
            onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Target Audience</Label>
        <div className="flex gap-4 pt-2">
          {AVAILABLE_ROLES.map(role => (
            <div key={role.value} className="flex items-center gap-2">
              <Checkbox
                id={role.value}
                checked={formData.target_roles.includes(role.value)}
                onCheckedChange={() => toggleRole(role.value)}
              />
              <label htmlFor={role.value} className="text-sm cursor-pointer">
                {role.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-fade-up">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.total || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Published</p>
              <p className="text-2xl font-bold text-success">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.active || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Draft</p>
              <p className="text-2xl font-bold text-warning">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.inactive || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-12 inline-block" /> : stats?.thisMonth || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Published</SelectItem>
                <SelectItem value="inactive">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
              {formFields}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleCreate(false)} disabled={createAnnouncement.isPending || uploadingImage}>
                  {(createAnnouncement.isPending || uploadingImage) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save as Draft
                </Button>
                <Button onClick={() => handleCreate(true)} disabled={createAnnouncement.isPending || uploadingImage}>
                  {(createAnnouncement.isPending || uploadingImage) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Send className="w-4 h-4 mr-2" />
                  Publish
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Announcements List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No announcements found</p>
                <p className="text-sm mt-1">
                  {debouncedSearch ? 'Try a different search term' : 'Create your first announcement to communicate with your school community'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex gap-3 md:gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          announcement.is_active ? 'bg-success/10' : 'bg-muted'
                        }`}>
                          <Bell className={`w-5 h-5 ${
                            announcement.is_active ? 'text-success' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm md:text-base">{announcement.title}</h3>
                            {announcement.is_active ? (
                              <Badge className="bg-success/10 text-success text-[10px]">Published</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Draft</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {announcement.content}
                          </p>
                          {announcement.image_url && (
                            <img src={announcement.image_url} alt="" className="w-full max-w-xs h-32 object-cover rounded-lg mb-2 border border-border" />
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(announcement.created_at), 'dd MMM yyyy')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {announcement.target_roles?.map(r =>
                                r.charAt(0).toUpperCase() + r.slice(1)
                              ).join(', ') || 'No audience'}
                            </span>
                            {announcement.expires_at && (
                              <span>Expires: {format(new Date(announcement.expires_at), 'dd MMM')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleToggle(announcement.id, announcement.is_active)}
                          title={announcement.is_active ? 'Unpublish' : 'Publish'}>
                          {announcement.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(announcement)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(announcement)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalCount={totalCount}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Announcement</DialogTitle></DialogHeader>
          {formFields}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateAnnouncement.isPending}>
              {updateAnnouncement.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAnnouncement?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
