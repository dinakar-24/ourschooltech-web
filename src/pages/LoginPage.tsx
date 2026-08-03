import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Loader2, ArrowRight, Lock, Eye, EyeOff, Shield, GraduationCap } from 'lucide-react';
import appLogo from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminOTPLogin } from '@/components/auth/SuperAdminOTPLogin';
import { LoginSplash } from '@/components/login/LoginSplash';
import { Input } from '@/components/ui/input';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { api } from '@/lib/api';
import { validateEmail, friendlyErrorMessage } from '@/lib/error-utils';

type LoginStep = 'splash' | 'email' | 'password' | 'superadmin';

interface SchoolInfo {
  school_name: string;
  school_id: string | null;
  has_logo: boolean;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_color: string | null;
  splash_screen_image_url: string | null;
  role: string;
  user_name: string;
  app_display_name: string | null;
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Administrator',
  teacher: 'Teacher',
  parent: 'Parent',
  student: 'Student',
};

const roleIcons: Record<string, string> = {
  super_admin: '🛡️',
  school_admin: '🏫',
  teacher: '👨‍🏫',
  parent: '👨‍👩‍👧',
  student: '🎓',
};

/** Races a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    ),
  ]);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<LoginStep>('splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSplashComplete = useCallback(() => setStep('email'), []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const paths: Record<string, string> = {
        super_admin: '/super-admin/dashboard',
        school_admin: '/admin/dashboard',
        teacher: '/teacher/dashboard',
        parent: '/parent/dashboard',
        student: '/student/dashboard',
      };
      navigate(paths[user.role] || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0B1120]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0B1120]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    setLookupLoading(true);
    setError('');

    const doLookup = () => api.get('/auth/lookup', { params: { email: email.trim() } });

    try {
      let result: any;
      try {
        const { data } = await withTimeout(doLookup(), 12000);
        result = data;
      } catch (firstErr: any) {
        if (firstErr.message === 'TIMEOUT') {
          // Retry once
          try {
            const { data } = await withTimeout(doLookup(), 12000);
            result = data;
          } catch (retryErr: any) {
            throw new Error(
              retryErr.message === 'TIMEOUT'
                ? 'Taking too long. Please check your connection and try again.'
                : (retryErr?.response?.data?.error || retryErr.message || 'Failed to look up account.')
            );
          }
        } else {
          throw new Error(firstErr?.response?.data?.error || firstErr.message || 'Failed to look up account.');
        }
      }

      if (!result?.found) {
        setError('No account found with this email address');
        setLookupLoading(false);
        return;
      }
      if (result.role === 'super_admin') {
        setLookupLoading(false);
        setStep('superadmin');
        return;
      }
      if (result.logo_url) {
        const img = new Image();
        img.src = result.logo_url;
      }
      setSchoolInfo(result);
      setLookupLoading(false);
      setStep('password');
    } catch (err: any) {
      setError(friendlyErrorMessage(err.message));
      setLookupLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { setError('Please enter your password'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(friendlyErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'password') {
      setStep('email');
      setPassword('');
      setError('');
      setSchoolInfo(null);
    } else {
      setStep('splash');
    }
  };

  if (step === 'splash') {
    return <LoginSplash onComplete={handleSplashComplete} />;
  }

  if (step === 'superadmin') {
    return (
      <div className="min-h-[100dvh] flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(145deg, hsl(225, 50%, 18%) 0%, hsl(230, 55%, 12%) 50%, hsl(220, 60%, 8%) 100%)' }}>
        <LoginBackground />
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 relative z-10">
          <div className="w-full max-w-sm login-fade-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Shield className="w-8 h-8 text-white/80" />
              </div>
              <h2 className="text-2xl font-bold text-white">Super Admin</h2>
              <p className="text-white/40 text-sm mt-1">System administrator access</p>
            </div>
            <div className="bg-white/[0.06] backdrop-blur-2xl rounded-2xl p-6 border border-white/[0.08] shadow-2xl">
              <SuperAdminOTPLogin onBack={() => setStep('email')} onSuccess={() => {}} initialEmail={email} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(145deg, hsl(225, 50%, 18%) 0%, hsl(230, 55%, 12%) 50%, hsl(220, 60%, 8%) 100%)' }}>
      <LoginBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-4 pt-4 pb-2 safe-area-top sm:px-5 sm:pt-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0">
            <img src={appLogo} alt="Our School Tech" className="w-full h-full object-contain" loading="eager" fetchPriority="high" decoding="sync" />
          </div>
          <span className="text-sm sm:text-lg font-bold text-white/90 tracking-tight">Our School Tech</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-5 py-4 relative z-10 overflow-auto">
        <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
          {step === 'email' && <EmailStep key="email" email={email} setEmail={setEmail} error={error} loading={lookupLoading} onSubmit={handleEmailSubmit} />}
          {step === 'password' && schoolInfo && (
            <PasswordStep
              key="password"
              email={email}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              error={error}
              loading={loading}
              schoolInfo={schoolInfo}
              onSubmit={handlePasswordSubmit}
              onChangeEmail={() => { setStep('email'); setPassword(''); setError(''); setSchoolInfo(null); }}
              onForgotPassword={() => setShowForgotPassword(true)}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-5 py-3 text-center safe-area-bottom">
        <p className="text-[11px] text-white/20">
          Need help? <a href="mailto:support@ourschooltech.com" className="hover:text-white/40 underline underline-offset-2">support@ourschooltech.com</a>
        </p>
      </footer>

      <ForgotPasswordDialog open={showForgotPassword} onClose={() => setShowForgotPassword(false)} />
    </div>
  );
}

/* ── Background (CSS-only, no framer-motion) ── */
function LoginBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full login-orb-1"
        style={{ background: 'radial-gradient(circle, hsl(230 60% 40% / 0.3), transparent 70%)' }} />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full login-orb-2"
        style={{ background: 'radial-gradient(circle, hsl(200 50% 35% / 0.2), transparent 70%)' }} />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full login-orb-3"
        style={{ background: 'radial-gradient(circle, hsl(260 50% 40% / 0.15), transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
      }} />
    </div>
  );
}

/* ── Email Step (CSS animations) ── */
const EmailStep = React.forwardRef<HTMLDivElement, {
  email: string;
  setEmail: (v: string) => void;
  error: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}>(({ email, setEmail, error, loading, onSubmit }, ref) => {
  return (
    <div ref={ref} className="flex flex-col login-fade-in">
      <div className="flex justify-center mb-6 login-scale-in">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-md flex items-center justify-center border border-white/[0.08] shadow-2xl">
          <GraduationCap className="w-10 h-10 text-white/60" />
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
        <p className="text-white/35 text-sm mt-1.5">Enter your email to continue</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white/[0.04] backdrop-blur-2xl rounded-2xl p-5 border border-white/[0.06] shadow-2xl space-y-4 login-slide-up"
      >
        <ErrorMessage error={error} />
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <Input
            type="email" placeholder="Email address" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-white/[0.06] border-white/[0.06] text-white placeholder:text-white/25 shadow-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/15"
            autoFocus
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full h-12 rounded-xl bg-white text-[hsl(225,50%,15%)] font-semibold text-sm shadow-lg shadow-white/10 flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-white/95 active:scale-[0.98] transition-all"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Finding account...</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>
    </div>
  );
});
EmailStep.displayName = 'EmailStep';

/* ── Password Step (CSS animations) ── */
function PasswordStep({ email, password, setPassword, showPassword, setShowPassword, error, loading, schoolInfo, onSubmit, onChangeEmail, onForgotPassword }: {
  email: string;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  error: string;
  loading: boolean;
  schoolInfo: SchoolInfo;
  onSubmit: (e: React.FormEvent) => void;
  onChangeEmail: () => void;
  onForgotPassword: () => void;
}) {
  const hasBanner = !!schoolInfo.splash_screen_image_url;
  const logoUrl = schoolInfo.logo_url || null;
  const [logoLoaded, setLogoLoaded] = useState(false);

  return (
    <div className="flex flex-col login-fade-in">
      {/* School banner & branding */}
      <div className="mb-5 rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl login-scale-in">
        {hasBanner && (
          <div className="relative h-32 overflow-hidden">
            <img
              src={schoolInfo.splash_screen_image_url!}
              alt={schoolInfo.school_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,50%,10%)] via-[hsl(225,50%,10%)/0.3] to-transparent" />
          </div>
        )}

        <div className={`bg-white/[0.04] backdrop-blur-2xl p-4 flex items-center gap-3.5 ${hasBanner ? '-mt-8 relative z-10 mx-3 rounded-xl border border-white/[0.08] bg-[hsl(225,50%,12%)/0.9] mb-3' : ''}`}>
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative">
            <div className={`absolute inset-0 bg-gradient-to-br from-white/[0.1] to-white/[0.04] flex items-center justify-center border border-white/[0.08] shadow-lg transition-opacity duration-300 ${logoLoaded ? 'opacity-0' : 'opacity-100'}`}>
              <span className="text-2xl font-bold text-white/60">{schoolInfo.school_name?.charAt(0)}</span>
            </div>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={schoolInfo.school_name}
                className={`w-full h-full object-contain transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLogoLoaded(true)}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate leading-tight">
              {schoolInfo.app_display_name || schoolInfo.school_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.08] text-white/60 border border-white/[0.06]">
                {roleIcons[schoolInfo.role] || '👤'} {roleLabels[schoolInfo.role] || schoolInfo.role}
              </span>
            </div>
          </div>
        </div>

        {!hasBanner && (
          <div className="px-4 pb-3 pt-1">
            <p className="text-white/30 text-xs">Welcome back, <span className="text-white/50">{schoolInfo.user_name}</span></p>
          </div>
        )}
      </div>

      {hasBanner && (
        <p className="text-white/30 text-xs text-center mb-3">Welcome back, <span className="text-white/50">{schoolInfo.user_name}</span></p>
      )}

      {/* Password form */}
      <form
        onSubmit={onSubmit}
        className="bg-white/[0.04] backdrop-blur-2xl rounded-2xl p-5 border border-white/[0.06] shadow-2xl space-y-3.5 login-slide-up"
      >
        <ErrorMessage error={error} />

        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.05]">
          <Mail className="w-3.5 h-3.5 text-white/25 shrink-0" />
          <span className="text-xs text-white/50 truncate flex-1">{email}</span>
          <button type="button" onClick={onChangeEmail}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors shrink-0">
            Change
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <Input
            type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 h-12 rounded-xl bg-white/[0.06] border-white/[0.06] text-white placeholder:text-white/25 shadow-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/15"
            autoFocus
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 text-white/25 hover:text-white/50 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full h-12 rounded-xl bg-white text-[hsl(225,50%,15%)] font-semibold text-sm shadow-lg shadow-white/10 flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-white/95 active:scale-[0.98] transition-all"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
          ) : (
            <><Lock className="w-3.5 h-3.5" /> Login</>
          )}
        </button>

        <div className="text-center pt-0.5">
          <button type="button" onClick={onForgotPassword}
            className="text-white/25 hover:text-white/50 text-xs transition-colors">
            Forgot password?
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Error Message (CSS transition) ── */
const ErrorMessage = React.forwardRef<HTMLDivElement, { error: string }>(
  function ErrorMessage({ error }, ref) {
    if (!error) return null;
    return (
      <div
        ref={ref}
        className="p-3 rounded-xl bg-red-500/10 border border-red-500/15 text-xs flex items-center gap-2 overflow-hidden login-fade-in"
      >
        <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-400 text-[10px] font-bold">!</div>
        <span className="text-red-300/80">{error}</span>
      </div>
    );
  }
);
