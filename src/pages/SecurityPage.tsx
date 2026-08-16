import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Monitor, Smartphone, Tablet, LogOut, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useSessions, useRevokeSession, useLogoutAll, type Session } from '@/hooks/useSessions';
import { useAuthStore } from '@/stores/authStore';

// Personal account security -- device list + revoke + "log out
// everywhere" (Part D, Pass B). Deliberately its own standalone route
// rather than duplicated across every role's separate profile page
// (TeacherProfile/ParentProfile/StudentProfile/AdminProfilePage all exist
// independently, no shared "Account" component to hang this off) -- linked
// from Sidebar.tsx/SuperAdminLayout.tsx instead, same as Switch School.

// Small bespoke summary, not a full UA-parsing library -- this app doesn't
// need more than "which kind of device and which browser", and pulling in
// a dependency for that felt disproportionate.
function summarizeUserAgent(ua: string | null): { label: string; Icon: typeof Monitor } {
  if (!ua) return { label: 'Unknown device', Icon: Monitor };

  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone/i.test(ua);
  const Icon = isTablet ? Tablet : isMobile ? Smartphone : Monitor;

  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    'Browser';

  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' :
    '';

  return { label: os ? `${browser} on ${os}` : browser, Icon };
}

function SessionRow({ session, onRevoke, isRevoking }: {
  session: Session;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  const { label, Icon } = summarizeUserAgent(session.userAgent);

  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{label}</p>
          {session.isCurrent && <Badge variant="secondary" className="text-[10px]">This device</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {session.ipAddress || 'Unknown IP'} · Active {formatDistanceToNow(new Date(session.lastUsedAt), { addSuffix: true })}
        </p>
      </div>
      {!session.isCurrent && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive shrink-0"
          disabled={isRevoking}
          onClick={() => onRevoke(session.id)}
        >
          Sign out
        </Button>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const navigate = useNavigate();
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const logoutAll = useLogoutAll();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogoutAll = async () => {
    try {
      await logoutAll.mutateAsync();
    } finally {
      // logout-all revokes the caller's own session too -- clear local
      // state immediately rather than leaving the UI showing "logged in"
      // against a refresh token the backend already deleted.
      useAuthStore.getState().clearAuth();
      setConfirmOpen(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Devices & Sessions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everywhere you're currently signed in. Sign out of any device you don't recognize.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : !sessions || sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active sessions found.</p>
          ) : (
            sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={(id) => revokeSession.mutate(id)}
                isRevoking={revokeSession.isPending}
              />
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" className="text-destructive hover:text-destructive gap-2" onClick={() => setConfirmOpen(true)}>
          <LogOut className="w-4 h-4" />
          Log out everywhere
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Log out everywhere?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This signs you out of every device, including this one. You'll need to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={logoutAll.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleLogoutAll(); }}
              disabled={logoutAll.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {logoutAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log out everywhere'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
