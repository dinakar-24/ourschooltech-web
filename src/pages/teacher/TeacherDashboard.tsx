import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ClipboardList,
  BookOpen,
  FileText,
  Bell,
  Users,
  ChevronRight,
  Clock,
  GraduationCap,
  BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from a Supabase RPC (get_teacher_dashboard_stats) + two table
// reads to /api/teacher/{profile,classes,homework}. The RPC's attendanceRate
// stat is DROPPED, not ported — there's no Express aggregate for "today's
// attendance rate across a teacher's classes" yet, and computing it
// client-side would mean one request per section. Flagged for a future
// backend-aggregate addition.
// ─────────────────────────────────────────────────────────────────────────

interface RawTeacherHomework {
  id: string;
  title: string;
  dueDate: string;
  subject: { name: string };
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Fetch teacher record for subjects
  const { data: teacher } = useQuery({
    queryKey: ['teacher-record', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ teacher: { subjects: string[] } }>('/teacher/profile');
      return data.teacher;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch class count from timetable-derived sections
  const { data: classCount = 0 } = useQuery({
    queryKey: ['teacher-class-count', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ sections: Array<{ classId: string }> }>('/teacher/classes');
      return new Set(data.sections.map(s => s.classId)).size;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch homework (also used for the "posted" count and upcoming list)
  const { data: homework, isLoading: loading } = useQuery({
    queryKey: ['teacher-homework', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ homework: RawTeacherHomework[] }>('/teacher/homework');
      return data.homework;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const totalHomework = homework?.length ?? 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingHomework = (homework ?? [])
    .filter(hw => hw.dueDate.split('T')[0] >= todayStr)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greetings.morning');
    if (hour < 17) return t('greetings.afternoon');
    return t('greetings.evening');
  };

  const quickActions = [
    { label: t('nav.attendance'), icon: ClipboardList, href: '/teacher/attendance', color: 'bg-emerald-500' },
    { label: t('nav.homework'), icon: BookOpen, href: '/teacher/homework', color: 'bg-blue-500' },
    { label: t('nav.marks'), icon: FileText, href: '/teacher/marks', color: 'bg-amber-500' },
    { label: t('nav.announcements'), icon: Bell, href: '/teacher/announcements', color: 'bg-rose-500' },
    { label: t('nav.results'), icon: BarChart3, href: '/teacher/marks', color: 'bg-purple-500' },
    { label: t('nav.timetable'), icon: Clock, href: '/teacher/timetable', color: 'bg-teal-500' },
    { label: t('nav.students'), icon: Users, href: '/teacher/students', color: 'bg-indigo-500' },
    { label: t('nav.profile'), icon: GraduationCap, href: '/teacher/profile', color: 'bg-primary' },
  ];

  const subjectCount = teacher?.subjects?.length ?? 0;

  return (
    <MobileLayout>
      <div className="p-4 space-y-5 pb-6">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {greeting()}, {user?.name?.split(' ')[0]}! 👋
            </h2>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {teacher?.subjects?.join(', ') || 'Teacher'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Classes</p>
            <p className="text-sm font-semibold text-foreground">{classCount}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <AdminStatCard
            title={t('teacher.dashboard.homework')}
            value={loading ? '...' : totalHomework.toLocaleString()}
            subtitle={t('teacher.dashboard.posted')}
            icon={<BookOpen className="w-4 h-4" />}
          />
          <AdminStatCard
            title="Subjects"
            value={String(subjectCount)}
            icon={<BookOpen className="w-4 h-4" />}
          />
          <AdminStatCard
            title="Classes"
            value={String(classCount)}
            icon={<Users className="w-4 h-4" />}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('teacher.dashboard.quickActions')}</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Link 
                key={action.label} 
                to={action.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all active:scale-95"
              >
                <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center shadow-sm`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Homework */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Upcoming Homework</h3>
            <Link to="/teacher/homework" className="text-xs text-primary font-medium">{t('common.viewAll')}</Link>
          </div>
          {upcomingHomework && upcomingHomework.length > 0 ? (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {upcomingHomework.map((hw) => (
                  <Link key={hw.id} to="/teacher/homework" className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-info/10 text-info flex items-center justify-center">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-foreground line-clamp-1">{hw.title}</span>
                        <p className="text-xs text-muted-foreground">{hw.subject.name} · Due {hw.dueDate.split('T')[0]}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No upcoming homework assigned.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
