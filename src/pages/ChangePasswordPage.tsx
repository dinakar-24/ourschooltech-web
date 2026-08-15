import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { getRefreshToken } from '@/stores/authStore';
import { api } from '@/lib/api';
import { validatePassword } from '@/lib/password-validation';
import { getRoleDashboard } from '@/components/auth/ProtectedRoute';

// The forced-first-login screen for TEMP_PASSWORD onboarding mode (Part D,
// Pass B). Reached only via ProtectedRoute's redirect when
// user.mustChangePassword is true -- the REAL enforcement blocking every
// other route is server-side (see middleware/tenant.js's resolveTenant),
// this is just the UI half of that gate.
export default function ChangePasswordPage() {
  const { user, loginWithSession, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Already changed (e.g. user navigated back here manually) -- nothing
  // left to gate, send them on to their real dashboard.
  if (user && !user.mustChangePassword) {
    return <Navigate to={getRoleDashboard(user.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) { setError(passwordError); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword === currentPassword) { setError('New password must be different from your current password'); return; }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        refreshToken: getRefreshToken(),
      });
      await loginWithSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to change password. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Change your password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            You're signing in with a temporary password. Set a new one to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Temporary password"
              className="pl-10 h-11"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="pl-10 pr-10 h-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Min 8 chars · uppercase · lowercase · number · special character</p>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="pl-10 h-11"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Changing password...' : 'Change Password'}
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
