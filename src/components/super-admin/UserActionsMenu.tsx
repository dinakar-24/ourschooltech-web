import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Ban,
  CheckCircle,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';
import { useManageUser } from '@/hooks/useManageUser';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserActionsMenuProps {
  userId: string;
  userName: string;
  userEmail: string;
  isDisabled?: boolean;
  isSelf?: boolean;
  onActionComplete: (action?: string, userId?: string) => void;
  currentFullName?: string;
  currentPhone?: string;
  onEditOverride?: () => void; // Custom edit handler (e.g. full student edit)
}

type PendingAction = 'delete' | 'disable' | 'enable' | 'reset_password';

export function UserActionsMenu({
  userId,
  userName,
  userEmail,
  isDisabled = false,
  isSelf = false,
  onActionComplete,
  currentFullName,
  currentPhone,
  onEditOverride,
}: UserActionsMenuProps) {
  const { user } = useAuth();
  const { manageUser, isProcessing } = useManageUser();
  const [editOpen, setEditOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [tempPassDialogOpen, setTempPassDialogOpen] = useState(false);

  // Password confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: currentFullName || userName,
    phone: currentPhone || '',
  });

  const actionLabels: Record<PendingAction, { title: string; description: string; button: string; variant: 'destructive' | 'default' }> = {
    delete: {
      title: 'Delete User',
      description: `Permanently delete ${userName} (${userEmail}) and all associated data. This cannot be undone.`,
      button: 'Delete User',
      variant: 'destructive',
    },
    disable: {
      title: 'Disable User',
      description: `Prevent ${userName} from logging in. They won't lose any data.`,
      button: 'Disable User',
      variant: 'default',
    },
    enable: {
      title: 'Enable User',
      description: `Re-enable ${userName}'s access to the system.`,
      button: 'Enable User',
      variant: 'default',
    },
    reset_password: {
      title: 'Reset Password',
      description: `Generate a temporary password for ${userName}. You'll need to share it securely.`,
      button: 'Reset Password',
      variant: 'default',
    },
  };

  const openConfirm = (action: PendingAction) => {
    setPendingAction(action);
    setPassword('');
    setShowPassword(false);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingAction || !password || !user?.email) return;

    setVerifying(true);
    try {
      // ⚠️ Gate deliberately NOT migrated yet.
      //
      // POST /api/auth/verify-password now exists and would fix this check —
      // but the actions it guards (useManageUser → the `manage-user` edge
      // function) have no Express equivalent yet. Swapping only the gate would
      // let the user pass the password prompt and then hit a different,
      // more confusing failure. Migrate both together.
      //
      // Net effect today: signInWithPassword always errors, so this reports
      // "Incorrect password" and the action aborts — it fails closed.
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) {
        toast.error('Incorrect password. Please try again.');
        setVerifying(false);
        return;
      }

      if (pendingAction === 'delete') {
        const result = await manageUser({ action: 'delete', user_id: userId });
        if (result.success) {
          setConfirmOpen(false);
          onActionComplete('delete', userId);
        }
      } else if (pendingAction === 'disable' || pendingAction === 'enable') {
        const result = await manageUser({ action: pendingAction, user_id: userId });
        if (result.success) {
          setConfirmOpen(false);
          onActionComplete(pendingAction, userId);
        }
      } else if (pendingAction === 'reset_password') {
        const result = await manageUser({ action: 'reset_password', user_id: userId });
        if (result.success && result.temp_password) {
          setTempPassword(result.temp_password);
          setConfirmOpen(false);
          setTempPassDialogOpen(true);
        }
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await manageUser({
      action: 'update_profile',
      user_id: userId,
      full_name: editForm.full_name,
      phone: editForm.phone,
    });
    if (result.success) {
      setEditOpen(false);
      onActionComplete('update_profile', userId);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    toast.success('Password copied to clipboard');
  };

  const currentAction = pendingAction ? actionLabels[pendingAction] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isProcessing}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover">
          <DropdownMenuItem onClick={() => {
            if (onEditOverride) { onEditOverride(); return; }
            setEditForm({ full_name: currentFullName || userName, phone: currentPhone || '' }); setEditOpen(true);
          }}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openConfirm('reset_password')}>
            <KeyRound className="w-4 h-4 mr-2" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!isSelf && (
            <DropdownMenuItem
              onClick={() => openConfirm(isDisabled ? 'enable' : 'disable')}
              className={isDisabled ? 'text-green-600' : 'text-yellow-600'}
            >
              {isDisabled ? <CheckCircle className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              {isDisabled ? 'Enable User' : 'Disable User'}
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <DropdownMenuItem onClick={() => openConfirm('delete')} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete User
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Password Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              {currentAction?.title}
            </DialogTitle>
            <DialogDescription>{currentAction?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Enter your password to confirm</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button
                variant={currentAction?.variant === 'destructive' ? 'destructive' : 'default'}
                onClick={handleConfirm}
                disabled={!password || verifying || isProcessing}
              >
                {verifying || isProcessing ? 'Verifying...' : currentAction?.button}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update {userName}'s profile information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temporary Password Display */}
      <Dialog open={tempPassDialogOpen} onOpenChange={setTempPassDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
            <DialogDescription>
              Share this password securely with {userName}. They should change it after login.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
            <span className="flex-1 break-all">{tempPassword}</span>
            <Button variant="ghost" size="icon" onClick={copyPassword} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}