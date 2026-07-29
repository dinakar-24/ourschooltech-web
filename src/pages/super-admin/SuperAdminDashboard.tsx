import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { SuperAdminQuickActions } from '@/components/super-admin/SuperAdminQuickActions';
import { RecentSchoolsList } from '@/components/super-admin/RecentSchoolsList';
import { SubscriptionOverview } from '@/components/super-admin/SubscriptionOverview';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Users, GraduationCap, CreditCard, School, ArrowUpRight, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 700;
    const steps = 30;
    const stepTime = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setDisplay(Math.round(value * eased));
      if (step >= steps) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}{suffix}</>;
}

interface StatTileProps {
  title: string;
  value: number;
  icon: ReactNode;
  gradient: string;
  href: string;
  delay?: number;
}

function StatTile({ title, value, icon, gradient, href, delay = 0 }: StatTileProps) {
  return (
    <Link
      to={href}
      className={cn(
        "relative group overflow-hidden rounded-2xl p-4 md:p-5 text-white transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
        gradient
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full bg-white/10 blur-sm" />
      <div className="absolute bottom-0 left-0 w-16 h-16 -ml-4 -mb-4 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            {icon}
          </div>
          <ArrowUpRight className="w-4 h-4 text-white/60 group-hover:text-white/90 transition-colors" />
        </div>
        <p className="text-2xl md:text-3xl font-extrabold tracking-tight">
          <AnimatedCounter value={value} />
        </p>
        <p className="text-xs font-medium text-white/75 mt-0.5">{title}</p>
      </div>
    </Link>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin-dashboard-stats'],
    queryFn: async () => {
      // Migrated from the get_super_admin_stats RPC. `activeSubscriptions`
      // was added to getDashboard for this — it counts schools whose
      // subscriptionEnd is still in the future.
      const { data } = await api.get('/superadmin/dashboard');
      const r = data.stats ?? {};
      return {
        totalSchools: Number(r.totalSchools ?? 0),
        totalStudents: Number(r.totalStudents ?? 0),
        totalTeachers: Number(r.totalTeachers ?? 0),
        activeSubscriptions: Number(r.activeSubscriptions ?? 0),
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SuperAdminLayout title="Dashboard">
      <div className="space-y-6 pb-8">
        {/* Hero Greeting */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-5 md:p-6 text-white">
          <div className="absolute top-0 right-0 w-40 h-40 -mr-10 -mt-10 rounded-full bg-white/10 blur-lg" />
          <div className="absolute bottom-0 left-0 w-32 h-32 -ml-8 -mb-8 rounded-full bg-white/5" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-white/70" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Command Center</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold">
              {greeting()}, {user?.name?.split(' ')[0] || 'Admin'} 👋
            </h2>
            <p className="text-sm text-white/70 mt-1">
              Here's what's happening across your platform today.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[120px] rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Failed to load stats.{' '}
            <button className="text-primary underline" onClick={() => refetch()}>Retry</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              title="Total Schools"
              value={stats?.totalSchools ?? 0}
              icon={<Building2 className="w-4.5 h-4.5" />}
              gradient="bg-gradient-to-br from-teal-500 to-teal-600"
              href="/super-admin/schools"
              delay={0}
            />
            <StatTile
              title="Total Students"
              value={stats?.totalStudents ?? 0}
              icon={<Users className="w-4.5 h-4.5" />}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
              href="/super-admin/schools"
              delay={50}
            />
            <StatTile
              title="Total Teachers"
              value={stats?.totalTeachers ?? 0}
              icon={<GraduationCap className="w-4.5 h-4.5" />}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
              href="/super-admin/schools"
              delay={100}
            />
            <StatTile
              title="Active Subs"
              value={stats?.activeSubscriptions ?? 0}
              icon={<CreditCard className="w-4.5 h-4.5" />}
              gradient="bg-gradient-to-br from-amber-500 to-orange-500"
              href="/super-admin/subscriptions"
              delay={150}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-primary" />
            Quick Actions
          </h3>
          <SuperAdminQuickActions />
        </div>

        {/* Two Column Layout for Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Schools */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <School className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Recent Schools
                </CardTitle>
                <Link to="/super-admin/schools" className="text-xs text-primary hover:underline font-medium">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <RecentSchoolsList />
            </CardContent>
          </Card>

          {/* Subscription Overview */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Subscriptions
                </CardTitle>
                <Link to="/super-admin/subscriptions" className="text-xs text-primary hover:underline font-medium">
                  Manage →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <SubscriptionOverview />
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
