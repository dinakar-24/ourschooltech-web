import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Bell, Pencil, Trash2, AlertTriangle, Info, AlertCircle, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AppRole } from '@/hooks/useAnnouncements';
import {
  SystemAnnouncement,
  AnnouncementPriority,
  useSystemAnnouncements,
  useCreateSystemAnnouncement,
  useUpdateSystemAnnouncement,
  useToggleSystemAnnouncement,
  useDeleteSystemAnnouncement,
} from '@/hooks/useSystemAnnouncements';

const priorityOptions: { value: AnnouncementPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'school_admin', label: 'School Admins' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'parent', label: 'Parents' },
  { value: 'student', label: 'Students' },
];

const defaultForm = {
  title: '',
  content: '',
  priority: 'normal' as AnnouncementPriority,
  target_roles: [] as AppRole[],
  expires_at: '',
};

export default function SystemAnnouncementsPage() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
  const [formData, setFormData] = useState(defaultForm);

  const { data: announcements = [], isLoading } = useSystemAnnouncements();
  const createMutation = useCreateSystemAnnouncement();
  const updateMutation = useUpdateSystemAnnouncement();
  const toggleMutation = useToggleSystemAnnouncement();
  const deleteMutation = useDeleteSystemAnnouncement();

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTitle, setDeletingTitle] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteVerifying, setDeleteVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAnnouncement) {
      updateMutation.mutate(
        { id: editingAnnouncement.id, ...formData },
        { onSuccess: () => { setIsDialogOpen(false); resetForm(); } }
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => { setIsDialogOpen(false); resetForm(); },
      });
    }
  };

  const handleEdit = (announcement: SystemAnnouncement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      target_roles: announcement.target_roles,
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  const openDeleteConfirm = (id: string, title: string) => {
    setDeletingId(id);
    setDeletingTitle(title);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingId || !deletePassword) return;

    setDeleteVerifying(true);
    try {
      // Re-confirm the super admin's own password via Express. The previous
      // supabase.auth.signInWithPassword re-auth always errors now, which
      // made this gate fail closed and blocked deletion entirely.
      try {
        await api.post('/auth/verify-password', { password: deletePassword });
      } catch (err: any) {
        toast.error(
          err?.response?.status === 401
            ? 'Incorrect password. Please try again.'
            : err?.response?.data?.error || 'Unable to verify identity'
        );
        return;
      }

      await deleteMutation.mutateAsync(deletingId);
      setDeleteConfirmOpen(false);
    } finally {
      setDeleteVerifying(false);
    }
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingAnnouncement(null);
  };

  const filteredAnnouncements = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <SuperAdminLayout title="System Announcements">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isMobile ? (
            <Drawer open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DrawerTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Announcement
                </Button>
              </DrawerTrigger>
              <DrawerContent className="px-4 pb-6 max-h-[90dvh]">
                <DrawerHeader className="px-0">
                  <DrawerTitle>{editingAnnouncement ? 'Edit Announcement' : 'New System Announcement'}</DrawerTitle>
                  <DrawerDescription>
                    This announcement will be visible to all users across all schools
                  </DrawerDescription>
                </DrawerHeader>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto" data-vaul-no-drag>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title-m">Title *</Label>
                      <Input
                        id="title-m"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Announcement title"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="content-m">Content *</Label>
                      <Textarea
                        id="content-m"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Write your announcement..."
                        rows={3}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="priority-m">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value: AnnouncementPriority) =>
                          setFormData({ ...formData, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="expires-m">Expires On</Label>
                      <Input
                        id="expires-m"
                        type="date"
                        value={formData.expires_at}
                        onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Target Roles (leave empty for all)</Label>
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => (
                          <Button
                            key={role.value}
                            type="button"
                            variant={formData.target_roles.includes(role.value) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                target_roles: formData.target_roles.includes(role.value)
                                  ? formData.target_roles.filter((r) => r !== role.value)
                                  : [...formData.target_roles, role.value],
                              });
                            }}
                          >
                            {role.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? 'Saving...' : editingAnnouncement ? 'Update' : 'Publish'}
                    </Button>
                  </div>
                </form>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'New System Announcement'}</DialogTitle>
                  <DialogDescription>
                    This announcement will be visible to all users across all schools
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Announcement title"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="content">Content *</Label>
                      <Textarea
                        id="content"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Write your announcement..."
                        rows={4}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value: AnnouncementPriority) =>
                            setFormData({ ...formData, priority: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="expires">Expires On</Label>
                        <Input
                          id="expires"
                          type="date"
                          value={formData.expires_at}
                          onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Target Roles (leave empty for all)</Label>
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => (
                          <Button
                            key={role.value}
                            type="button"
                            variant={formData.target_roles.includes(role.value) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                target_roles: formData.target_roles.includes(role.value)
                                  ? formData.target_roles.filter((r) => r !== role.value)
                                  : [...formData.target_roles, role.value],
                              });
                            }}
                          >
                            {role.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Saving...' : editingAnnouncement ? 'Update' : 'Publish'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Announcements Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              All Announcements ({filteredAnnouncements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No announcements yet</p>
                <p className="text-sm mt-1">Create your first system announcement</p>
              </div>
            ) : isMobile ? (
              /* Mobile Card Layout */
              <div className="divide-y">
                {filteredAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {getPriorityIcon(announcement.priority)}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{announcement.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{announcement.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(announcement)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => openDeleteConfirm(announcement.id, announcement.title)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={getPriorityVariant(announcement.priority)} className="text-[10px]">{announcement.priority}</Badge>
                        {announcement.target_roles && announcement.target_roles.length > 0 ? (
                          announcement.target_roles.map(role => (
                            <Badge key={role} variant="outline" className="text-[10px]">{role.replace('_', ' ')}</Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">All users</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={announcement.is_active}
                          onCheckedChange={() => toggleMutation.mutate({ id: announcement.id, isActive: !announcement.is_active })}
                        />
                        <span className={`text-xs ${announcement.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                          {announcement.is_active ? 'Active' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop Table */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Announcement</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnnouncements.map((announcement) => (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            {getPriorityIcon(announcement.priority)}
                            <div>
                              <p className="font-medium">{announcement.title}</p>
                              <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">{announcement.content}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={getPriorityVariant(announcement.priority)}>{announcement.priority}</Badge></TableCell>
                        <TableCell>
                          {announcement.target_roles && announcement.target_roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {announcement.target_roles.map(role => (
                                <Badge key={role} variant="outline" className="text-xs">{role.replace('_', ' ')}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">All users</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={announcement.is_active}
                              onCheckedChange={() => toggleMutation.mutate({ id: announcement.id, isActive: !announcement.is_active })}
                            />
                            <span className={announcement.is_active ? 'text-success' : 'text-muted-foreground'}>
                              {announcement.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(announcement.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(announcement)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(announcement.id, announcement.title)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Delete Announcement
            </DialogTitle>
            <DialogDescription>
              Permanently delete "{deletingTitle}". This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="delete-confirm-password">Enter your password to confirm</Label>
              <div className="relative">
                <Input
                  id="delete-confirm-password"
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteConfirmed()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirmed}
                disabled={!deletePassword || deleteVerifying}
              >
                {deleteVerifying ? 'Verifying...' : 'Delete Announcement'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
