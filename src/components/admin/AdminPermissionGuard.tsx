import { Navigate, useLocation } from 'react-router-dom';
import { useMyAdminPermissions, PATH_TO_MODULE } from '@/hooks/useAdminPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminPermissionGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps admin routes to redirect to dashboard if the admin lacks permission for that module.
 * Only applies to school_admin role. Super admins always pass through.
 */
export function AdminPermissionGuard({ children }: AdminPermissionGuardProps) {
  const { user } = useAuth();
  const { hasPathAccess, loading } = useMyAdminPermissions();
  const location = useLocation();

  // Only restrict school_admin, not super_admin viewing as admin
  if (!user || user.role !== 'school_admin') return <>{children}</>;
  // Same reasoning as SubscriptionGuard: a slow permissions check should
  // read as "loading", not blank the whole page.
  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Extract the path segment after /admin/
  const match = location.pathname.match(/^\/admin(\/[^/]+)/);
  if (!match) return <>{children}</>; // dashboard or unknown

  const pathSegment = match[1];
  
  // Dashboard and profile are always accessible
  if (pathSegment === '/dashboard' || pathSegment === '/profile') return <>{children}</>;

  if (!hasPathAccess(pathSegment)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
