import { ReactNode } from 'react';
import { useSubscriptionStatus } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Lock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: ReactNode;
}

/**
 * Wraps admin pages to enforce subscription access control.
 * - Active/Trial: Full access
 * - Expired: Read-only with renewal prompt
 * - Suspended: Blocked completely
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subscription, isLoading, isActive, isExpired } = useSubscriptionStatus();

  // Super admins bypass subscription checks
  if (user?.role === 'super_admin') {
    return <>{children}</>;
  }

  // Only apply to school_admin
  if (user?.role !== 'school_admin') {
    return <>{children}</>;
  }

  // A blocking DB round-trip (school's own connection, not this page's) can
  // genuinely take a few seconds under load -- rendering nothing here reads
  // as "the app is broken", not "the app is loading". Match the app's other
  // skeleton loading states instead of leaving the page dark.
  if (isLoading) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Suspended
  if ((subscription?.status as string) === 'suspended') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-destructive">Account Suspended</h2>
            <p className="text-sm text-muted-foreground">
              Your school's account has been suspended. Please contact the platform administrator for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (isExpired) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-warning">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <h2 className="text-xl font-bold">Subscription Expired</h2>
            <p className="text-sm text-muted-foreground">
              Your subscription has expired. Please renew to continue using all features. You can still view existing data but cannot make changes.
            </p>
            <Button onClick={() => navigate('/admin/subscription')} className="mt-2">
              <CreditCard className="w-4 h-4 mr-2" />
              Renew Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
