import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentProfile, useStudentAttendanceStats } from '@/hooks/useStudentData';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Phone,
  GraduationCap,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Calendar,
  BookOpen,
  MapPin,
  Hash,
  Users,
} from 'lucide-react';

export default function StudentProfile() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: student, isLoading } = useStudentProfile();
  const { data: attendanceStats } = useStudentAttendanceStats(student?.id);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: t('profilePage.notificationSettings'), icon: Bell, href: '/student/notifications' },
    { label: t('profilePage.myTimetable'), icon: Calendar, href: '/student/timetable' },
    { label: t('profilePage.mySubjects'), icon: BookOpen, href: '/student/subjects' },
    { label: t('profilePage.appSettings'), icon: Settings, href: '/student/settings' },
  ];

  return (
    <MobileLayout title={t('profilePage.title')}>
      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-5">
            {isLoading ? (
              <div className="flex items-center gap-4 mb-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <AvatarUpload
                    value={student?.avatar_url || user?.avatar}
                    onChange={async (url) => {
                      await api.patch('/student/profile', { photo: url });
                      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
                    }}
                    fallback={user?.name}
                    size="lg"
                    folder="students"
                  />
                  <div>
                    <h2 className="text-lg font-bold">{student?.full_name || user?.name}</h2>
                    {student?.roll_number && (
                      <p className="text-sm text-muted-foreground">{t('profilePage.rollNo')} {student.roll_number}</p>
                    )}
                    <Badge variant="secondary" className="mt-1">{t('common.student')}</Badge>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-3 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{student?.class_name || user?.className} - {student?.section || user?.section}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{t('profilePage.admNo')} {student?.admission_number || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{user?.email}</span>
                  </div>
                  {/* parent_phone/parent_name are always null post-migration — see
                      useStudentData.ts's migration-notes comment. Left as-is
                      since they're already null-guarded; will start rendering
                      again if that data ever gets wired up. */}
                  {student?.parent_phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{student.parent_phone}</span>
                    </div>
                  )}
                  {student?.parent_name && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{t('profilePage.parent')} {student.parent_name}</span>
                    </div>
                  )}
                  {student?.address && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="line-clamp-2">{student.address}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-success">{attendanceStats?.percentage || 0}%</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.attendance')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{student?.blood_group || '-'}</p>
              <p className="text-xs text-muted-foreground">{t('profilePage.bloodGroup')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-warning">{student?.gender || '-'}</p>
              <p className="text-xs text-muted-foreground">{t('profilePage.gender')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Items */}
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.href)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Logout */}
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t('common.signOut')}
        </Button>
      </div>
    </MobileLayout>
  );
}
