import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, User, Building2, GraduationCap, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { api } from '@/lib/api';

// Migrated from a Supabase Realtime `postgres_changes` subscription on
// audit_logs to a poll -- Express has no Realtime equivalent, and with no
// Supabase session the old channel could never fire again (same reasoning
// as useNotifications.ts, same 60s interval).
const POLL_INTERVAL_MS = 60_000;

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  user_id: string | null;
}

const entityIcons: Record<string, typeof Building2> = {
  schools: Building2,
  profiles: User,
  students: GraduationCap,
  teachers: GraduationCap,
};

const actionLabels: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
};

export function NotificationsDropdown() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey: ['super-admin-audit-logs'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/audit-logs', { params: { limit: 20 } });
      return data.logs as AuditLog[];
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    const stored = localStorage.getItem('sa_last_seen_notification');
    setLastSeen(stored);
    if (logs.length > 0 && (!stored || logs[0].created_at > stored)) {
      setHasNew(true);
    }
  }, [logs]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && logs.length > 0) {
      setHasNew(false);
      localStorage.setItem('sa_last_seen_notification', logs[0].created_at);
      setLastSeen(logs[0].created_at);
    }
  };

  const getEntityLabel = (log: AuditLog) => {
    const name = (log.details as any)?.name;
    const entity = log.entity_type.replace(/_/g, ' ').replace(/s$/, '');
    const action = actionLabels[log.action] || log.action;
    return name ? `${entity} "${name}" ${action}` : `${entity} ${action}`;
  };

  const triggerButton = (
    <Button variant="ghost" size="icon-sm" className="relative" onClick={() => handleOpen(true)}>
      <Bell className="w-5 h-5" />
      {hasNew && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
      )}
    </Button>
  );

  const notificationsList = (
    <ScrollArea className="max-h-80">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No recent activity
        </div>
      ) : (
        <div className="py-1">
          {logs.map((log) => {
            const Icon = entityIcons[log.entity_type] || FileText;
            const isNew = lastSeen ? log.created_at > lastSeen : true;
            return (
              <div
                key={log.id}
                className={`flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors ${isNew ? 'bg-primary/5' : ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug truncate">{getEntityLabel(log)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                </div>
                {isNew && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Drawer open={open} onOpenChange={handleOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Notifications</DrawerTitle>
              <p className="text-xs text-muted-foreground">Recent activity across the platform</p>
            </DrawerHeader>
            {notificationsList}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <p className="text-xs text-muted-foreground">Recent activity across the platform</p>
        </div>
        {notificationsList}
      </PopoverContent>
    </Popover>
  );
}
