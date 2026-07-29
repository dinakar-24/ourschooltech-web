import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ClipboardList,
  CreditCard,
  FileText,
  User,
  BookOpen,
  Award,
  LogOut,
  ChevronLeft,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

// Nav config uses translation keys for labels
const navConfigKeys: Record<UserRole, Array<{ labelKey: string; href: string; icon: typeof LayoutDashboard }>> = {
  super_admin: [],
  school_admin: [],
  teacher: [
    { labelKey: 'nav.home', href: '/teacher/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.attendance', href: '/teacher/attendance', icon: ClipboardList },
    { labelKey: 'nav.homework', href: '/teacher/homework', icon: BookOpen },
    { labelKey: 'nav.results', href: '/teacher/marks', icon: FileText },
    { labelKey: 'nav.profile', href: '/teacher/profile', icon: User },
  ],
  parent: [
    { labelKey: 'nav.home', href: '/parent/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.attendance', href: '/parent/attendance', icon: ClipboardList },
    { labelKey: 'nav.homework', href: '/parent/homework', icon: BookOpen },
    { labelKey: 'nav.fees', href: '/parent/fees', icon: CreditCard },
    { labelKey: 'nav.more', href: '/parent/more', icon: MoreHorizontal },
  ],
  student: [
    { labelKey: 'nav.home', href: '/student/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.attendance', href: '/student/attendance', icon: ClipboardList },
    { labelKey: 'nav.homework', href: '/student/homework', icon: BookOpen },
    { labelKey: 'nav.results', href: '/student/results', icon: Award },
    { labelKey: 'nav.profile', href: '/student/profile', icon: User },
  ],
};

export function MobileLayout({ children, title, showBack, onBack }: MobileLayoutProps) {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // The Supabase `profile-avatar` fallback query was removed, not migrated.
  // It resolved an avatar that this component never rendered — the header
  // shows the school logo and the notification bell, not a user avatar. So it
  // was a per-mount round trip on every teacher/parent/student page for a
  // value that was thrown away.
  //
  // If an avatar is ever wanted here, use `user.avatar` — GET /auth/me already
  // resolves it from the role-specific profile. Note Parent and SchoolAdmin
  // have no photo column in Prisma, so theirs would be null.

  const role = user?.role || 'student';
  const navItems = navConfigKeys[role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground safe-area-top">
        <div className="flex items-center justify-between h-14 px-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {showBack && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className="text-primary-foreground hover:bg-primary-foreground/10 shrink-0 -ml-1 w-9 h-9"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            {school?.logo && (
              <img src={school.logo} alt={school.name} className="w-7 h-7 object-contain shrink-0 rounded" />
            )}
            <h1 className="text-[15px] font-semibold truncate">
              {title || school?.name || 'Dashboard'}
            </h1>
          </div>
          
          <div className="shrink-0 ml-2">
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
        <div className="flex justify-around items-center py-2 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
