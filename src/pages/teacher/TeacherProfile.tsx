import { MobileLayout } from '@/components/layout/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Users,
  GraduationCap,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Migrated from Supabase (teachers + profiles tables) to /api/teacher/profile.
// Teacher already carries phone/photo directly, so the old second query
// against `profiles` is gone entirely, not just rewired.
//
// "classes" reuses the same GET /api/teacher/classes + dedupe-by-classId
// approach as TeacherDashboard.tsx, so both pages report the same number
// for the same teacher.
//
// "Since" now reads Teacher.joiningDate (added mirroring the subjects/photo
// precedent) instead of showing '-'.
// ─────────────────────────────────────────────────────────────────────────

interface RawTeacherProfile {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  phone: string | null;
  photo: string | null;
  qualification: string | null;
  subjects: string[];
  joiningDate: string | null;
}

export default function TeacherProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-profile-detail', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ teacher: RawTeacherProfile }>('/teacher/profile');
      return data.teacher;
    },
    enabled: !!user?.id,
  });

  const { data: classCount = 0 } = useQuery({
    queryKey: ['teacher-class-count', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ sections: Array<{ classId: string }> }>('/teacher/classes');
      return new Set(data.sections.map(s => s.classId)).size;
    },
    enabled: !!user?.id,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Notifications', icon: Bell, href: '/teacher/notifications' },
    { label: 'My Timetable', icon: Calendar, href: '/teacher/timetable' },
    { label: 'My Students', icon: Users, href: '/teacher/students' },
    { label: 'Feedback', icon: MessageSquare, href: '/teacher/feedback' },
    { label: 'Help & Queries', icon: HelpCircle, href: '/teacher/queries' },
    { label: 'Settings', icon: Settings, href: '/teacher/settings' },
  ];

  const subjectCount = teacher?.subjects?.length ?? 0;

  return (
    <MobileLayout title="Profile">
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
                    value={teacher?.photo || user?.avatar}
                    onChange={async (url) => {
                      await api.patch('/teacher/profile', { photo: url });
                      queryClient.invalidateQueries({ queryKey: ['teacher-profile-detail'] });
                    }}
                    fallback={user?.name}
                    size="lg"
                    folder="teachers"
                  />
                  <div>
                    <h2 className="text-lg font-bold">{teacher ? `${teacher.firstName} ${teacher.lastName}` : user?.name}</h2>
                    <p className="text-sm text-muted-foreground">{teacher?.employeeId}</p>
                    <Badge variant="secondary" className="mt-1">Teacher</Badge>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{teacher?.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{teacher?.subjects?.join(', ') || 'No subjects assigned'}</span>
                  </div>
                  {teacher?.qualification && (
                    <div className="flex items-center gap-3 text-sm">
                      <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{teacher.qualification}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats from real data */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : (
                <p className="text-2xl font-bold text-primary">{subjectCount}</p>
              )}
              <p className="text-xs text-muted-foreground">Subjects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : (
                <p className="text-2xl font-bold text-success">{classCount}</p>
              )}
              <p className="text-xs text-muted-foreground">Classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : (
                <p className="text-2xl font-bold text-warning">
                  {teacher?.joiningDate ? new Date(teacher.joiningDate).getFullYear() : '-'}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Since</p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Items - all linked to real routes */}
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
          Sign Out
        </Button>
      </div>
    </MobileLayout>
  );
}
