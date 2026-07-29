import { SuperAdminLayout } from '@/components/layout/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import {
  Building2,
  Users,
  GraduationCap,
  CreditCard,
  IndianRupee,
  TrendingUp,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAllSubscriptions } from '@/hooks/useSubscription';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function SuperAdminReportsPage() {
  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['super-admin-report-stats'],
    queryFn: async () => {
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
  });

  // Role counts — now returned alongside the user list rather than by a
  // dedicated RPC, so limit=1 keeps the payload small.
  // ⚠️ `no_role` is always 0: User.role is a required enum in Express, so a
  // user without a role cannot exist. See useAllUsers for the full note.
  const { data: roleCounts, isLoading: rolesLoading } = useQuery({
    queryKey: ['role-counts-report'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/users', { params: { limit: 1 } });
      return data.roleCounts as Record<string, number>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // City distribution — aggregated client-side exactly as before, just from
  // the Express school list instead of a direct table read.
  const { data: cities } = useQuery({
    queryKey: ['city-distribution'],
    queryFn: async () => {
      const { data } = await api.get('/superadmin/schools', { params: { limit: 200 } });
      const cityMap: Record<string, number> = {};
      (data.schools as Array<{ city: string | null; isActive: boolean; isSuspended: boolean }>)
        .filter(s => s.isActive && !s.isSuspended)
        .forEach(s => {
          if (!s.city) return;
          cityMap[s.city] = (cityMap[s.city] || 0) + 1;
        });
      return Object.entries(cityMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Subscriptions
  const { data: subscriptions, isLoading: subsLoading } = useAllSubscriptions();

  const subStats = {
    active: subscriptions?.filter(s => s.status === 'active').length ?? 0,
    trial: subscriptions?.filter(s => s.status === 'trial').length ?? 0,
    expired: subscriptions?.filter(s => s.status === 'expired').length ?? 0,
    pending: subscriptions?.filter(s => s.status === 'pending').length ?? 0,
    totalRevenue: subscriptions?.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.total_amount || 0), 0) ?? 0,
    totalStudentsBilled: subscriptions?.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.student_count || 0), 0) ?? 0,
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  const loading = statsLoading || rolesLoading || subsLoading;

  return (
    <SuperAdminLayout title="Reports">
      <div className="space-y-6 pb-6 animate-fade-up">
        {/* Overview Stats */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">System Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <AdminStatCard
              title="Schools"
              value={loading ? '...' : (stats?.totalSchools ?? 0).toString()}
              icon={<Building2 className="w-4 h-4" />}
            />
            <AdminStatCard
              title="Students"
              value={loading ? '...' : (stats?.totalStudents ?? 0).toLocaleString()}
              icon={<Users className="w-4 h-4" />}
            />
            <AdminStatCard
              title="Teachers"
              value={loading ? '...' : (stats?.totalTeachers ?? 0).toLocaleString()}
              icon={<GraduationCap className="w-4 h-4" />}
            />
            <AdminStatCard
              title="Active Subs"
              value={loading ? '...' : (stats?.activeSubscriptions ?? 0).toString()}
              icon={<CreditCard className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* User Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              User Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rolesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <>
                {[
                  { label: 'Super Admins', count: Number(roleCounts?.super_admin ?? 0), color: 'bg-destructive' },
                  { label: 'School Admins', count: Number(roleCounts?.school_admin ?? 0), color: 'bg-primary' },
                  { label: 'Teachers', count: Number(roleCounts?.teacher ?? 0), color: 'bg-emerald-500' },
                  { label: 'Parents', count: Number(roleCounts?.parent ?? 0), color: 'bg-amber-500' },
                  { label: 'Students', count: Number(roleCounts?.student ?? 0), color: 'bg-blue-500' },
                ].map(item => {
                  const total = Number(roleCounts?.all ?? 1);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span className="text-muted-foreground">{item.count} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        {/* Revenue Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              Revenue Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs font-medium text-muted-foreground mb-1">Total Active Revenue</p>
              <p className="text-2xl font-bold text-primary">
                {loading ? '...' : formatCurrency(subStats.totalRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {subStats.totalStudentsBilled.toLocaleString()} students across {subStats.active} schools
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Active', value: subStats.active, color: 'text-success' },
                { label: 'Trial', value: subStats.trial, color: 'text-warning' },
                { label: 'Pending', value: subStats.pending, color: 'text-muted-foreground' },
                { label: 'Expired', value: subStats.expired, color: 'text-destructive' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 text-center">
                  <p className={`text-xl font-bold ${item.color}`}>{loading ? '...' : item.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* City Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Schools by City
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!cities || cities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No school data available</p>
            ) : (
              <div className="space-y-2">
                {cities.map(([city, count]) => {
                  const total = cities.reduce((s, [, c]) => s + c, 0);
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={city} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{count} school{count !== 1 ? 's' : ''}</Badge>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
