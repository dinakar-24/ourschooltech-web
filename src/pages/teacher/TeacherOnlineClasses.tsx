import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  useTeacherOnlineClasses,
  useTeacherEligibleSections,
  useCreateOnlineClass,
  useUpdateOnlineClass,
  useDeleteOnlineClass,
  OnlineClass,
} from '@/hooks/useOnlineClasses';
import { useSubjects } from '@/hooks/useClasses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/time-picker';
import { Video, ExternalLink, Clock, Calendar as CalendarIcon, Plus, Edit2, Trash2 } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { EmptyState } from '@/components/ui/data-states';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const platforms = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'ms_teams', label: 'Microsoft Teams' },
  { value: 'custom', label: 'Custom' },
];

const defaultForm = {
  section_id: '',
  subject_id: 'none',
  title: '',
  description: '',
  platform: 'zoom',
  meeting_url: '',
  meeting_id: '',
  password: '',
  scheduled_date: undefined as Date | undefined,
  scheduled_time: '09:00',
  duration_minutes: 60,
  status: 'SCHEDULED',
};

export default function TeacherOnlineClasses() {
  const { data: classes = [], isLoading } = useTeacherOnlineClasses();
  const { data: sections = [] } = useTeacherEligibleSections();
  const createMutation = useCreateOnlineClass();
  const updateMutation = useUpdateOnlineClass();
  const deleteMutation = useDeleteOnlineClass();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<OnlineClass | null>(null);
  const [form, setForm] = useState(defaultForm);

  const selectedSection = sections.find(s => s.id === form.section_id);
  const { data: subjects = [] } = useSubjects(selectedSection?.classId);

  const upcoming = classes.filter(c => c.status === 'SCHEDULED' && isFuture(new Date(c.scheduled_at)));
  const past = classes.filter(c => c.status !== 'SCHEDULED' || isPast(new Date(c.scheduled_at)));

  const openCreate = () => {
    setEditingClass(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (cls: OnlineClass) => {
    setEditingClass(cls);
    const scheduledDate = cls.scheduled_at ? new Date(cls.scheduled_at) : undefined;
    setForm({
      section_id: cls.section_id,
      subject_id: cls.subject_id || 'none',
      title: cls.title,
      description: cls.description || '',
      platform: cls.platform,
      meeting_url: cls.meeting_url || '',
      meeting_id: cls.meeting_id || '',
      password: cls.password || '',
      scheduled_date: scheduledDate,
      scheduled_time: scheduledDate ? format(scheduledDate, 'HH:mm') : '09:00',
      duration_minutes: cls.duration_minutes,
      status: cls.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title || !form.scheduled_date || !form.section_id) return;
    const [hours, minutes] = form.scheduled_time.split(':').map(Number);
    const scheduledAt = new Date(form.scheduled_date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const payload = {
      section_id: form.section_id,
      subject_id: form.subject_id === 'none' ? null : form.subject_id,
      title: form.title,
      description: form.description || null,
      platform: form.platform,
      meeting_url: form.meeting_url || null,
      meeting_id: form.meeting_id || null,
      password: form.password || null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: form.duration_minutes,
      status: form.status,
    };

    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const formTitle = editingClass ? 'Edit Online Class' : 'Schedule Online Class';
  const formSubmitLabel = editingClass ? 'Save Changes' : 'Create Class';
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Online Classes</h1>
            <p className="text-sm text-muted-foreground">Schedule and manage your virtual class sessions</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Schedule Class
          </Button>
        </div>

        {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : classes.length === 0 ? (
          <EmptyState icon={Video} title="No online classes" description="Schedule your first virtual class to get started." />
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Upcoming</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {upcoming.map(cls => (
                    <Card key={cls.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Video className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold">{cls.title}</h3>
                          </div>
                          <Badge variant="outline" className="capitalize">{cls.platform.replace('_', ' ')}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" />{format(new Date(cls.scheduled_at), 'dd MMM yyyy, hh:mm a')}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{cls.duration_minutes} min</span>
                        </div>
                        {cls.class_name && <p className="text-xs text-muted-foreground">Class {cls.class_name}{cls.section ? ` - ${cls.section}` : ''} {cls.subject ? `• ${cls.subject}` : ''}</p>}
                        <div className="flex items-center gap-2">
                          {cls.meeting_url && (
                            <Button className="flex-1 gap-2" asChild>
                              <a href={cls.meeting_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" />Start Class</a>
                            </Button>
                          )}
                          <Button variant="outline" size="icon" onClick={() => openEdit(cls)}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(cls.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-muted-foreground">Past Classes</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {past.map(cls => (
                    <Card key={cls.id} className="opacity-70">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-medium">{cls.title}</h3>
                          <Badge variant="secondary" className="ml-auto capitalize text-xs">{cls.status.toLowerCase()}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(cls.scheduled_at), 'dd MMM yyyy, hh:mm a')} • {cls.duration_minutes} min</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Maths - Chapter 5" />
            </div>

            <div className="grid gap-2">
              <Label>Section *</Label>
              <Select
                value={form.section_id}
                onValueChange={v => setForm(f => ({ ...f, section_id: v, subject_id: 'none' }))}
                disabled={!!editingClass}
              >
                <SelectTrigger><SelectValue placeholder="Select a section you teach" /></SelectTrigger>
                <SelectContent>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.className} - {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sections.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  You're not assigned to any section yet (via the timetable or as class teacher).
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))} disabled={!form.section_id}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Subject</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {editingClass && (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="LIVE">Live</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !form.title || !form.scheduled_date || !form.section_id}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {formSubmitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
