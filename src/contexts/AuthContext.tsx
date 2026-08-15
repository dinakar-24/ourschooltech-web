import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/authStore';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionWarningBanner } from '@/components/layout/SessionWarningBanner';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase Auth to the Express/JWT backend.
//
// The exported `useAuth()` shape is UNCHANGED so every route guard, page and
// layout keeps working with zero edits. What changed is only where the data
// comes from: POST /auth/login + GET /auth/me instead of supabase.auth.
//
// Dropped in the migration (both had zero callers and relied on Supabase RPCs
// with no Express equivalent): `signup()` and `useSchoolSearch()`.
// ─────────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'parent' | 'student';

export interface School {
  id: string;
  name: string;
  code: string;
  logo?: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  // Added for ThemeProvider's school-theme half — /auth/me already returns
  // these (Prisma's `school: true` include pulls every scalar column), they
  // just weren't threaded through mapSchool until now.
  primaryColor?: string;
  accentColor?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  schoolId: string;
  schoolName: string;
  childName?: string;
  className?: string;
  section?: string;
  employeeId?: string;
  subjects?: string[];
  // Part D, Pass B -- TEMP_PASSWORD onboarding mode's forced-first-login
  // flag. ProtectedRoute.tsx redirects to /change-password whenever this
  // is true, for every role, regardless of which route was requested.
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  school: School | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, schoolId?: string) => Promise<void>;
  /**
   * Adopt a session obtained outside the password flow — currently the Super
   * Admin OTP login, whose verify step returns the same token payload as
   * POST /auth/login.
   *
   * Callers must use this rather than authStore.setAuth() directly: setAuth
   * only fills the token store, leaving AuthContext's `user` null, so every
   * route guard would still treat the user as logged out.
   */
  loginWithSession: (payload: { accessToken: string; refreshToken: string; user: unknown }) => Promise<void>;
  logout: () => void;
  selectSchool: (school: School) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The backend returns the Prisma enum (`SUPER_ADMIN`); every route guard in
 * App.tsx and `getRoleDashboard()` compare against lowercase (`super_admin`).
 * Skipping this mapping makes login appear to succeed while every protected
 * route silently bounces to a dashboard — do not remove.
 */
function toUserRole(role: string | undefined): UserRole {
  return String(role ?? '').toLowerCase() as UserRole;
}

/** Raw `user` payload from POST /auth/login and GET /auth/me. */
interface RawAuthUser {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
  name?: string | null;
  avatar?: string | null;
  phone?: string | null;
  mustChangePassword?: boolean;
  school?: {
    id?: string;
    name: string;
    subdomain?: string;
    schoolCode?: string;
    logo?: string | null;
    primaryColor?: string;
    accentColor?: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

function mapSchool(raw: RawAuthUser): School | null {
  if (!raw.school) return null;
  return {
    id: raw.school.id ?? raw.schoolId ?? '',
    name: raw.school.name,
    // Backend calls it schoolCode; the UI has always called it code.
    code: raw.school.schoolCode ?? '',
    logo: raw.school.logo || undefined,
    address: raw.school.address ?? '',
    city: raw.school.city ?? '',
    phone: raw.school.phone || undefined,
    email: raw.school.email || undefined,
  };
}

function mapUser(raw: RawAuthUser, school: School | null): User {
  return {
    id: raw.id,
    name: raw.name || raw.email,
    email: raw.email,
    role: toUserRole(raw.role),
    avatar: raw.avatar || undefined,
    phone: raw.phone || undefined,
    schoolId: raw.schoolId ?? '',
    schoolName: school?.name ?? '',
    mustChangePassword: Boolean(raw.mustChangePassword),
  };
}

// --- sessionStorage cache helpers (unchanged) ---
const AUTH_CACHE_KEY = 'ost_auth_cache';

function cacheAuthData(user: User, school: School | null) {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user, school, ts: Date.now() }));
  } catch { /* quota exceeded is non-critical */ }
}

function getCachedAuth(): { user: User; school: School | null } | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 30 minutes
    if (Date.now() - parsed.ts > 30 * 60 * 1000) {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return { user: parsed.user, school: parsed.school };
  } catch {
    return null;
  }
}

function clearAuthCache() {
  try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore from cache for instant UI on reopen
  const cached = getCachedAuth();
  const [user, setUser] = useState<User | null>(cached?.user ?? null);
  const [school, setSchool] = useState<School | null>(cached?.school ?? null);
  const [isLoading, setIsLoading] = useState(!cached);
  const { tenant, isSubdomain } = useTenant();

  const clearSession = useCallback(() => {
    useAuthStore.getState().clearAuth();
    setUser(null);
    setSchool(null);
    clearAuthCache();
  }, []);

  // Cross-tenant validation
  const validateTenant = useCallback(async (userData: User) => {
    if (isSubdomain && tenant) {
      if (userData.schoolId !== tenant.schoolId) {
        clearSession();
        toast.error('Your account does not belong to this school. Please use the correct school portal.');
        return false;
      }
    }
    return true;
  }, [isSubdomain, tenant, clearSession]);

  const applyAuthUser = useCallback(async (raw: RawAuthUser) => {
    const schoolData = mapSchool(raw);
    const userData = mapUser(raw, schoolData);

    const isValid = await validateTenant(userData);
    if (!isValid) return null;

    setUser(userData);
    setSchool(schoolData);
    cacheAuthData(userData, schoolData);
    return userData;
  }, [validateTenant]);

  // Session restore. authStore rehydrates from IndexedDB asynchronously, so
  // wait for `hydrated` before concluding there's no token — otherwise every
  // refresh would look logged-out for a tick.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (!useAuthStore.getState().hydrated) {
        await new Promise<void>((resolve) => {
          const unsub = useAuthStore.subscribe((state) => {
            if (state.hydrated) { unsub(); resolve(); }
          });
          // Guard against the store having hydrated between the check and the
          // subscribe call.
          if (useAuthStore.getState().hydrated) { unsub(); resolve(); }
        });
      }

      if (cancelled) return;

      if (!useAuthStore.getState().accessToken) {
        clearSession();
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) await applyAuthUser(data.user as RawAuthUser);
      } catch {
        // 401 here means the token and its refresh are both dead; the axios
        // interceptor has already attempted a refresh.
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    restore();
    return () => { cancelled = true; };
  }, [applyAuthUser, clearSession]);

  const selectSchool = (selectedSchool: School) => {
    setSchool(selectedSchool);
  };

  const login = async (email: string, password: string, schoolId?: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password, schoolId });

      useAuthStore.getState().setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user as AuthUser,
      });

      await applyAuthUser(data.user as RawAuthUser);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Login failed. Please try again.';
      logError('auth', `Login failed: ${message}`, { email }, 'warning');
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithSession = useCallback(async (payload: {
    accessToken: string;
    refreshToken: string;
    user: unknown;
  }) => {
    useAuthStore.getState().setAuth({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user as AuthUser,
    });
    await applyAuthUser(payload.user as RawAuthUser);
    setIsLoading(false);
  }, [applyAuthUser]);

  const logout = useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // Best effort — the local session is cleared either way.
    }
    clearSession();
  }, [clearSession]);

  const handleSessionTimeout = useCallback(() => {
    toast.info('You have been logged out due to inactivity.');
    logout();
  }, [logout]);

  const { showWarning, remainingSeconds, extendSession } = useSessionTimeout(user?.role, handleSessionTimeout);

  return (
    <AuthContext.Provider value={{
      user,
      school,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithSession,
      logout,
      selectSchool,
    }}>
      {children}
      {showWarning && (
        <SessionWarningBanner
          remainingSeconds={remainingSeconds}
          onExtend={extendSession}
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
