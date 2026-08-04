import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Video, Edit2, Trash2, ExternalLink, Search, Loader2, Clock, Users as UsersIcon, CalendarIcon } from 'lucide-react';
import { TimePicker } from '@/components/ui/time-picker';
import { useOnlineClasses, useCreateOnlineClass, useUpdateOnlineClass, useDeleteOnlineClass, OnlineClass } from '@/hooks/useOnlineClasses';
import { useClasses } from '@/hooks/useClasses';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { EmptyState } from '@/components/ui/data-states';
import { cn } from '@/lib/utils';

const platforms = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'ms_teams', label: 'Microsoft Teams' },
  { value: 'custom', label: 'Custom' },
];

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  live: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const defaultForm = {
  title: '',
  description: '',
  platform: 'zoom',
  meeting_url: '',
  meeting_id: '',
  password: '',
  class_name: '',
  section: '',
  subject: '',
  teacher_name: '',
  teacher_id: '',
  scheduled_date: undefined as Date | undefined,
  scheduled_time: '09:00',
  duration_minutes: 60,
  status: 'scheduled',
};

export default function OnlineClassesPage() {
  const schoolId = useEffectiveSchoolId();
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<OnlineClass | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: classes = [], isLoading } = useOnlineClasses({ status: statusFilter });
  const { data: classData } = useClasses();
  const createMutation = useCreateOnlineClass();
  const updateMutation = useUpdateOnlineClass();
  const deleteMutation = useDeleteOnlineClass();

  const schoolClasses = classData || [];

  const filtered = classes.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.subject?.toLowerCase().includes(search.toLowerCase()) ||
    c.class_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingClass(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (cls: OnlineClass) => {
    setEditingClass(cls);
    const scheduledDate = cls.scheduled_at ? new Date(cls.scheduled_at) : undefined;
    setForm({
      title: cls.title,
      description: cls.description || '',
      platform: cls.platform,
      meeting_url: cls.meeting_url || '',
      meeting_id: cls.meeting_id || '',
      password: cls.password || '',
      class_name: cls.class_name || '',
      section: cls.section || '',
      subject: cls.subject || '',
      teacher_name: cls.teacher?.full_name || '',
      teacher_id: cls.teacher_id || '',
      scheduled_date: scheduledDate,
      scheduled_time: scheduledDate ? format(scheduledDate, 'HH:mm') : '09:00',
      duration_minutes: cls.duration_minutes,
      status: cls.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title || !form.scheduled_date) return;
    const [hours, minutes] = form.scheduled_time.split(':').map(Number);
    const scheduledAt = new Date(form.scheduled_date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const payload = {
      title: form.title,
      platform: form.platform,
      duration_minutes: form.duration_minutes,
      status: form.status,
      school_id: schoolId,
      scheduled_at: scheduledAt.toISOString(),
      teacher_id: form.teacher_id || null,
      description: form.description || null,
      meeting_url: form.meeting_url || null,
      meeting_id: form.meeting_id || null,
      password: form.password || null,
      class_name: form.class_name || null,
      section: form.section || null,
      subject: form.subject || null,
      created_by: null,
    };

    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const formContent = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>Title *</Label>
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Maths - Chapter 5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Platform</Label>
          <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {platforms.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Duration (min)</Label>
          <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Meeting URL</Label>
        <Input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} placeholder="https://zoom.us/j/..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Meeting ID</Label>
          <Input value={form.meeting_id} onChange={e => setForm(f => ({ ...f, meeting_id: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Password</Label>
          <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Scheduled Date *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !form.scheduled_date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.scheduled_date ? format(form.scheduled_date, 'dd MMM yyyy') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={form.scheduled_date}
              onSelect={(date) => setForm(f => ({ ...f, scheduled_date: date }))}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid gap-2">
        <Label>Time *</Label>
        <TimePicker
          value={form.scheduled_time}
          onChange={(val) => setForm(f => ({ ...f, scheduled_time: val }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Class</Label>
          <Select value={form.class_name} onValueChange={v => setForm(f => ({ ...f, class_name: v }))}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {schoolClasses.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Section</Label>
          <Input value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} placeholder="A, B, C..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Subject</Label>
          <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" />
        </div>
        <div className="grid gap-2">
          <Label>Teacher</Label>
          <Input value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} placeholder="e.g. Mr. Sharma" />
        </div>
      </div>
      {editingClass && (
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes..." rows={3} />
      </div>
    </div>
  );

  const formTitle = editingClass ? 'Edit Online Class' : 'Schedule Online Class';
  const formSubmitLabel = editingClass ? 'Save Changes' : 'Create Class';
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Online Classes</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Manage virtual classes and meeting links</p>
          </div>
          <Button onClick={openCreate} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Schedule Class
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Video} title="No online classes" description="Schedule your first virtual class to get started." />
        ) : isMobile ? (
          /* Mobile Card Layout */
          <div className="space-y-3">
            {filtered.map(cls => (
              <Card key={cls.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Video className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium text-sm truncate">{cls.title}</span>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${statusColors[cls.status] || ''}`}>
                      {cls.status}
                    </Badge>
                  </div>

                  {cls.subject && (
                    <p className="text-xs text-muted-foreground">{cls.subject}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{format(new Date(cls.scheduled_at), 'dd MMM, hh:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{cls.duration_minutes} min</span>
                      <span>• {cls.platform.replace('_', ' ')}</span>
                    </div>
                    {cls.class_name && (
                      <div className="flex items-center gap-1.5">
                        <UsersIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{cls.class_name}{cls.section ? ` - ${cls.section}` : ''}</span>
                      </div>
                    )}
                    {cls.teacher?.full_name && (
                      <div className="truncate">
                        <span>{cls.teacher.full_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    {cls.meeting_url && (
                      <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                        <a href={cls.meeting_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Join
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(cls)} className="text-xs">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(cls.id)} className="text-xs text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Desktop Table Layout */
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(cls => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary" />
                        {cls.title}
                      </div>
                      {cls.subject && <p className="text-xs text-muted-foreground">{cls.subject}</p>}
                    </TableCell>
                    <TableCell className="capitalize">{cls.platform.replace('_', ' ')}</TableCell>
                    <TableCell>{cls.class_name}{cls.section ? ` - ${cls.section}` : ''}</TableCell>
                    <TableCell>{cls.teacher?.full_name || '—'}</TableCell>
                    <TableCell>{format(new Date(cls.scheduled_at), 'dd MMM yyyy, hh:mm a')}</TableCell>
                    <TableCell>{cls.duration_minutes} min</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[cls.status] || ''}>{cls.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {cls.meeting_url && (
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a href={cls.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cls)}><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteMutation.mutate(cls.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mobile: Drawer | Desktop: Dialog */}
      {isMobile ? (
        <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
          <DrawerContent className="max-h-[90dvh] flex flex-col bg-background">
            <DrawerHeader className="text-left">
              <DrawerTitle>{formTitle}</DrawerTitle>
            </DrawerHeader>
            <div data-vaul-no-drag className="flex-1 min-h-0 overflow-y-auto px-4">
              {formContent}
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {formSubmitLabel}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{formTitle}</DialogTitle>
            </DialogHeader>
            {formContent}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {formSubmitLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
