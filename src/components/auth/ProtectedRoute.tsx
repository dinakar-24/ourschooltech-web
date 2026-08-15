import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useTenant } from '@/contexts/TenantContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireImpersonation?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireImpersonation }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isImpersonating } = useImpersonation();
  const { isSubdomain } = useTenant();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center gap-4 bg-background">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" fill="#fff" stroke="#5a5ce6" strokeWidth="3" />
          <circle cx="32" cy="32" r="6" fill="#000" style={{ animation: 'eyeOrbit 1.4s linear infinite' }} />
        </svg>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" fill="#fff" stroke="#5a5ce6" strokeWidth="3" />
          <circle cx="32" cy="32" r="6" fill="#000" style={{ animation: 'eyeOrbit 1.4s linear 0.2s infinite' }} />
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (isSubdomain) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // TEMP_PASSWORD onboarding mode's forced-first-login gate (Part D, Pass
  // B) -- client-side redirect for UX, NOT the real enforcement (that's
  // server-side in resolveTenant, which blocks every other API route
  // regardless of what the UI does). This just stops every other page
  // from rendering and immediately 403'ing on its first data fetch.
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && user) {
    const hasRole = allowedRoles.includes(user.role);
    
    if (hasRole && requireImpersonation && user.role === 'super_admin' && !isImpersonating) {
      return <Navigate to="/super-admin/schools" replace />;
    }

    if (!hasRole) {
      const dashboardPath = getRoleDashboard(user.role);
      return <Navigate to={dashboardPath} replace />;
    }
  }

  return <>{children}</>;
}

export function getRoleDashboard(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard';
    case 'school_admin':
      return '/admin/dashboard';
    case 'teacher':
      return '/teacher/dashboard';
    case 'parent':
      return '/parent/dashboard';
    case 'student':
      return '/student/dashboard';
    default:
      return '/login';
  }
}
