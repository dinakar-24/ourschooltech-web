import { AdminQuickActions } from '@/components/admin/AdminQuickActions';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { TodaysSummary } from '@/components/admin/TodaysSummary';
import { PendingTasks } from '@/components/admin/PendingTasks';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useQueryClient } from '@tanstack/react-query';
import { Users, GraduationCap, CreditCard, ClipboardList, CalendarDays, RefreshCw } from 'lucide-react';
import { useCurrentAcademicYear } from '@/hooks/useAcademicYears';
import { useSchoolReportStats } from '@/hooks/useSchoolReportStats';
import { useState, useRef, useCallback } from 'react';

const formatCurrency = (amount: number) => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function AdminDashboard() {
  const { user, school } = useAuth();
  const { impersonatedSchool, isImpersonating } = useImpersonation();

  const { data: reportStats, isLoading: loading } = useSchoolReportStats();
  const stats = reportStats && {
    totalStudents: reportStats.totalStudents,
    totalTeachers: reportStats.totalTeachers,
    feeCollected: reportStats.totalFeeCollected,
    attendanceRate: reportStats.attendanceToday.total > 0
      ? Math.round((reportStats.attendanceToday.present / reportStats.attendanceToday.total) * 100)
      : 0,
  };

  const { data: currentAcademicYear } = useCurrentAcademicYear();
  const displaySchoolName = isImpersonating ? impersonatedSchool?.name : school?.name;
  const displaySchoolLogo = isImpersonating ? impersonatedSchool?.logo : school?.logo;
  const queryClient = useQueryClient();

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) setPullY(Math.min(diff * 0.4, 60));
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullY > 40 && !refreshing) {
      setRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['school-report-stats'] });
      setTimeout(() => {
        setRefreshing(false);
        setPullY(0);
      }, 600);
    } else {
      setPullY(0);
    }
  }, [pullY, refreshing, queryClient]);

  const displayGreeting = getGreeting();

  return (
      <div 
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="space-y-4 pb-6"
      >
        {/* Pull to refresh indicator */}
        <div 
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullY > 0 || refreshing ? `${Math.max(pullY, refreshing ? 36 : 0)}px` : '0px' }}
        >
          <RefreshCw className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </div>
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            {displaySchoolLogo ? (
              <img src={displaySchoolLogo} alt={displaySchoolName || 'School'} className="w-12 h-12 md:w-14 md:h-14 object-contain shrink-0" />
            ) : (
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 md:w-7 md:h-7 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-lg font-bold text-foreground leading-tight truncate">
                {displayGreeting}, {user?.name?.split(' ')[0]}! 👋
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground truncate mt-0.5">
                {displaySchoolName || 'Your School'}
              </p>
            </div>
          </div>
          {currentAcademicYear && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs md:text-sm font-semibold text-foreground">{currentAcademicYear.name}</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5 md:gap-3">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </>
          ) : (
            <>
              <AdminStatCard
                title="Students"
                value={(stats?.totalStudents ?? 0).toLocaleString()}
                icon={<Users className="w-4 h-4" />}
                iconColor="text-blue-600"
                iconBg="bg-blue-100"
              />
              <AdminStatCard
                title="Teachers"
                value={(stats?.totalTeachers ?? 0).toLocaleString()}
                icon={<GraduationCap className="w-4 h-4" />}
                iconColor="text-teal-600"
                iconBg="bg-teal-100"
              />
              <AdminStatCard
                title="Fee Collected"
                value={formatCurrency(stats?.feeCollected ?? 0)}
                icon={<CreditCard className="w-4 h-4" />}
                iconColor="text-purple-600"
                iconBg="bg-purple-100"
              />
              <AdminStatCard
                title="Attendance"
                value={`${stats?.attendanceRate ?? 0}%`}
                subtitle="today"
                icon={<ClipboardList className="w-4 h-4" />}
                iconColor="text-amber-600"
                iconBg="bg-amber-100"
              />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xs md:text-sm font-semibold text-foreground mb-2.5">Quick Actions</h3>
          <AdminQuickActions />
        </div>

        <PendingTasks />
        <TodaysSummary />
      </div>
  );
}
