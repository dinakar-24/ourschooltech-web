import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { validatePassword } from '@/lib/password-validation';

// Public, pre-auth -- landed on from the Welcome Email's "Set Your
// Password" link (see backend/src/controllers/onboarding.controller.js).
// The account this token belongs to has no usable password yet
// (User.pendingPasswordSetup), so there is nothing to authenticate with
// here -- this page IS the authentication, in the sense that possessing a
// valid link proves control of the email the account was created for.
export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [linkError, setLinkError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLinkError('This link is missing its token.');
      setChecking(false);
      return;
    }
    api.get('/auth/set-password/verify', { params: { token } })
      .then(() => setLinkValid(true))
      .catch((err) => setLinkError(err?.response?.data?.error || 'This link is invalid or has expired'))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      await api.post('/auth/set-password', { token, newPassword: password });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to set password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {checking ? (
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Checking your link...</p>
          </div>
        ) : done ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Password set</h1>
              <p className="text-muted-foreground text-sm mt-1">Your account is now active. You can log in with your new password.</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Go to Login
            </button>
          </div>
        ) : !linkValid ? (
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Link invalid</h1>
              <p className="text-muted-foreground text-sm mt-1">{linkError}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full h-11 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">Set your password</h1>
              <p className="text-muted-foreground text-sm mt-1">Choose a password to activate your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="pl-10 pr-10 h-11"
                    autoFocus
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
                  placeholder="Confirm password"
                  className="pl-10 h-11"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Setting password...' : 'Set Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
