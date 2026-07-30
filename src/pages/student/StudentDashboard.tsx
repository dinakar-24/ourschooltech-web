import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BookOpen, Award, Bell, CheckCircle, AlertCircle, Calendar, 
  ImageIcon, Bus, Video, ChevronRight, Clock, Megaphone,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStudentProfile, useStudentAttendanceStats, useStudentHomework, useStudentAnnouncements } from '@/hooks/useStudentData';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { WelcomeCard } from '@/components/student-dashboard/WelcomeCard';
import { QuickStats } from '@/components/student-dashboard/QuickStats';
import { QuickAccessGrid } from '@/components/student-dashboard/QuickAccessGrid';
import { HomeworkSection } from '@/components/student-dashboard/HomeworkSection';
import { AnnouncementsSection } from '@/components/student-dashboard/AnnouncementsSection';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: student, isLoading: studentLoading } = useStudentProfile();
  const { data: attendanceStats, isLoading: attendanceLoading } = useStudentAttendanceStats(student?.id);
  const { data: homework, isLoading: homeworkLoading } = useStudentHomework(student?.class_name, student?.section, student?.school_id);
  // Was the shared admin useAnnouncements() hook — that returns every active
  // announcement school-wide with no role/class targeting, so a student saw
  // teacher-only notices too. useStudentAnnouncements hits the endpoint that
  // already scopes to targetRole IS NULL OR 'STUDENT' server-side.
  const { data: announcements, isLoading: announcementsLoading } = useStudentAnnouncements(student?.school_id);

  const studentInfo = student ? {
    name: student.full_name,
    class: student.class_name,
    section: student.section,
    rollNo: student.roll_number || '-',
  } : {
    name: user?.name || t('common.student'),
    class: 'N/A',
    section: 'N/A',
    rollNo: '-',
  };

  const attendance = attendanceStats?.percentage || 0;
  const pendingHomework = homework?.length || 0;

  return (
    <MobileLayout>
      <div className="p-4 space-y-5 pb-6">
        <WelcomeCard
          student={student}
          studentInfo={studentInfo}
          studentLoading={studentLoading}
          user={user}
          t={t}
        />

        {!student && !studentLoading && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3.5 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">{t('dashboard.profileNotLinked')}</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.contactAdmin')}</p>
            </div>
          </div>
        )}

        <QuickStats
          attendance={attendance}
          attendanceLoading={attendanceLoading}
          pendingHomework={pendingHomework}
          homeworkLoading={homeworkLoading}
          t={t}
        />

        <QuickAccessGrid />

        {/* Timetable Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <Link to="/student/timetable" className="block">
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98]">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-5.5 h-5.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{t('dashboard.viewTimetable')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {student ? `${student.class_name} - ${student.section}` : t('dashboard.viewClassSchedule')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>
        </motion.div>

        <HomeworkSection
          homework={homework}
          homeworkLoading={homeworkLoading}
          t={t}
        />

        <AnnouncementsSection
          announcements={announcements ?? []}
          announcementsLoading={announcementsLoading}
          t={t}
        />
      </div>
    </MobileLayout>
  );
}
