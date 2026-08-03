import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendReminderDialog({ open, onOpenChange }: Props) {
  const schoolId = useEffectiveSchoolId();
  const [target, setTarget] = useState<'pending' | 'overdue'>('pending');
  const [sending, setSending] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const fetchCount = async (t: 'pending' | 'overdue') => {
    if (!schoolId) return;
    const { data } = await api.get<{ count: number }>('/school/fees/reminder-count', { params: { target: t } });
    setCount(data.count);
  };

  const handleTargetChange = (v: 'pending' | 'overdue') => {
    setTarget(v);
    fetchCount(v);
  };

  // Fetch count on open
  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (o) fetchCount(target);
  };

  const handleSend = async () => {
    if (!schoolId) return;
    setSending(true);
    try {
      const { data } = await api.post<{ message: string; notified: number }>('/school/fees/send-reminders', { target });
      if (data.notified === 0) {
        toast.info('No users to notify');
      } else {
        toast.success(data.message);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" /> Send Fee Reminders
          </DialogTitle>
          <DialogDescription>Push notifications will be sent to parents and students with outstanding fees.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <Select value={target} onValueChange={(v: any) => handleTargetChange(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">All Pending</SelectItem>
                <SelectItem value="overdue">Only Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {count !== null && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{count}</span> student(s) with {target} fees will be notified.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || count === 0}>
            {sending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Send Reminders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
