import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface DeleteSchoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolName: string;
  onConfirm: () => Promise<void>;
}

export function DeleteSchoolDialog({ open, onOpenChange, schoolName, onConfirm }: DeleteSchoolDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleConfirm = async () => {
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setIsVerifying(true);
    try {
      // Re-confirm the super admin's own password via Express. The previous
      // supabase.auth.signInWithPassword re-auth always errors now, which made
      // this gate fail closed and blocked school deletion entirely.
      try {
        await api.post('/auth/verify-password', { password });
      } catch (err: any) {
        toast.error(
          err?.response?.status === 401
            ? 'Incorrect password. Please try again.'
            : err?.response?.data?.error || 'Unable to verify identity'
        );
        return;
      }

      await onConfirm();
      onOpenChange(false);
      setPassword('');
    } catch {
      toast.error('Failed to delete school');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">Delete School</AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <span className="block">
              You are about to permanently delete <strong className="text-foreground">{schoolName}</strong> and <strong className="text-foreground">all associated data</strong> including:
            </span>
            <span className="block text-xs">
              Students, Teachers, Admins, Attendance, Fees, Exams, Results, Gallery, Announcements, and all user accounts.
            </span>
            <span className="block font-medium text-destructive">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-password">Super Admin Password</Label>
          <div className="relative">
            <Input
              id="delete-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={isVerifying || !password.trim()}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Delete School'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
