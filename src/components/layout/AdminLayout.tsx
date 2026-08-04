import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useMyAdminPermissions, PATH_TO_MODULE } from '@/hooks/useAdminPermissions';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  ClipboardList,
  CreditCard,
  BookOpen,
  FileText,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  School,
  BarChart3,
  Clock,
  LogOut,
  Menu,
  X,
  Video,
  Bus,
  Image,
  MessageSquare,
  HelpCircle,
  CheckCheck,
  Megaphone,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MenuItem {
  label: string;
  href: string;
  icon: any;
  children?: { label: string; href: string }[];
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    group: '',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Core',
    items: [
      { 
        label: 'Students', href: '/admin/students', icon: Users,
        children: [
          { label: 'All Students', href: '/admin/students' },
          { label: 'Add Student', href: '/admin/students?action=add' },
          { label: 'Bulk Upload', href: '/admin/students/bulk-upload' },
        ]
      },
      { label: 'Teachers', href: '/admin/teachers', icon: GraduationCap },
      { label: 'Classes', href: '/admin/classes', icon: BookOpen },
      { label: 'Fees', href: '/admin/fees', icon: CreditCard },
      { 
        label: 'Attendance', href: '/admin/attendance', icon: ClipboardList,
        children: [
          { label: 'Students', href: '/admin/attendance' },
          { label: 'Holiday Calendar', href: '/admin/holiday-calendar' },
          { label: 'Employees', href: '/admin/employee-attendance' },
        ]
      },
    ],
  },
  {
    group: 'Academic',
    items: [
      { label: 'Exams', href: '/admin/exams', icon: FileText },
      { label: 'Timetable', href: '/admin/timetable', icon: Clock },
      { label: 'Online Classes', href: '/admin/online-classes', icon: Video },
      { label: 'Academic Years', href: '/admin/academic-years', icon: Calendar },
    ],
  },
  {
    group: 'Communication',
    items: [
      { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell },
      { label: 'Feedback', href: '/admin/feedback', icon: MessageSquare },
      { label: 'Queries', href: '/admin/queries', icon: HelpCircle },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { label: 'Gallery', href: '/admin/gallery', icon: Image },
      { label: 'Transport', href: '/admin/transport', icon: Bus },
      { label: 'Subscription', href: '/admin/subscription', icon: CreditCard },
      { label: 'My Profile', href: '/admin/profile', icon: Users },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

// Translation key mapping
const labelToKey: Record<string, string> = {
  'Dashboard': 'sidebar.dashboard', 'Students': 'sidebar.students', 'Teachers': 'sidebar.teachers',
  'Classes': 'sidebar.classes', 'Attendance': 'sidebar.attendance', 'Fees': 'sidebar.fees',
  'Exams': 'sidebar.exams', 'Online Classes': 'sidebar.onlineClasses', 'Transport': 'sidebar.transport',
  'Academic Years': 'sidebar.academicYears', 'Timetable': 'sidebar.timetable',
  'Announcements': 'sidebar.announcements', 'Bulk Upload': 'sidebar.bulkUpload', 'Gallery': 'sidebar.gallery',
  'Feedback': 'sidebar.feedback', 'Queries': 'sidebar.queries', 'Reports': 'sidebar.reports',
  'Subscription': 'sidebar.subscription', 'Settings': 'sidebar.settings',
  'All Students': 'sidebar.allStudents', 'Add Student': 'sidebar.addStudent',
  'Holiday Calendar': 'sidebar.holidayCalendar', 'Employees': 'sidebar.employees',
  'My Profile': 'sidebar.myProfile',
};

// Top-bar page title, keyed by exact pathname. Route `handle` + useMatches()
// would be the idiomatic react-router way to do this, but useMatches()
// requires a data router (createBrowserRouter/RouterProvider) -- this app
// uses the classic <BrowserRouter>/<Routes> setup, where useMatches() throws
// (confirmed against react-router's own source: it reads a context that's
// only populated by RouterProvider). A static lookup avoids that entirely.
const ADMIN_PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/students': 'Students',
  '/admin/teachers': 'Teachers',
  '/admin/classes': 'Classes & Sections',
  '/admin/attendance': 'Attendance',
  '/admin/holiday-calendar': 'Holiday Calendar',
  '/admin/employee-attendance': 'Employee Attendance',
  '/admin/fees': 'Fees Management',
  '/admin/exams': 'Examinations',
  '/admin/academic-years': 'Academic Years',
  '/admin/timetable': 'Timetable',
  '/admin/announcements': 'Announcements',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
  '/admin/profile': 'Profile',
  '/admin/subscription': 'Subscription',
  '/admin/bulk-upload': 'Bulk Upload',
  '/admin/online-classes': 'Online Classes',
  '/admin/transport': 'Transport',
  '/admin/gallery': 'Gallery',
  '/admin/feedback': 'Feedback',
  '/admin/queries': 'Support Queries',
  '/admin/students/bulk-upload': 'Bulk Upload',
  '/admin/notifications': 'Notifications',
  '/admin/install-app': 'Install App',
};

const notifTypeIcons: Record<string, typeof Bell> = {
  attendance: ClipboardList,
  homework: BookOpen,
  fee: CreditCard,
  announcement: Megaphone,
  result: Award,
  feedback: MessageSquare,
  query: HelpCircle,
  general: Bell,
};

const notifTypeColors: Record<string, string> = {
  attendance: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  homework: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
  fee: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  announcement: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950',
  result: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  feedback: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950',
  query: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950',
  general: 'text-muted-foreground bg-muted',
};

function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const rolePrefix = user?.role === 'teacher' ? '/teacher'
    : user?.role === 'parent' ? '/parent'
    : user?.role === 'student' ? '/student'
    : user?.role === 'school_admin' ? '/admin'
    : '/super-admin';

  const recent = notifications.slice(0, 6);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-in zoom-in-50">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] md:w-[400px] p-0 rounded-xl shadow-xl border-border/60" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-bold">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5">
                  {unreadCount}
                </span>
              )}
            </h3>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead()} className="text-xs h-7 gap-1 text-primary hover:text-primary">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[380px]">
          {recent.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <Bell className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/60 mt-1">No notifications yet</p>
            </div>
          ) : (
            <div className="py-1">
              {recent.map((n, i) => {
                const Icon = notifTypeIcons[n.type] || Bell;
                const colorClass = notifTypeColors[n.type] || notifTypeColors.general;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 hover:bg-muted/60 mx-1 rounded-lg my-0.5",
                      !n.is_read && "bg-primary/[0.04]"
                    )}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                  >
                    <div className={cn("p-2 rounded-xl shrink-0", colorClass)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] leading-tight", !n.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-medium">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5 ring-2 ring-primary/20" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border/60 p-2 bg-muted/20 rounded-b-xl">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-9 font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
              onClick={() => { setOpen(false); navigate(`${rolePrefix}/notifications`); }}
            >
              View all notifications
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// 250ms is the standard hover-intent debounce for auto-expanding nav rails --
// long enough that briefly crossing the sidebar on the way elsewhere doesn't
// trigger it, short enough that a deliberate mouse-leave feels immediate.
const HOVER_COLLAPSE_DELAY_MS = 250;

export function AdminLayout() {
  const { user, school, logout } = useAuth();
  const { impersonatedSchool, isImpersonating } = useImpersonation();
  const { t } = useTranslation();
  const { hasPathAccess } = useMyAdminPermissions();
  const displaySchoolName = isImpersonating ? impersonatedSchool?.name : school?.name;
  const displaySchoolLogo = isImpersonating ? impersonatedSchool?.logo : school?.logo;
  const navigate = useNavigate();
  const location = useLocation();
  const title = ADMIN_PAGE_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/admin/fees/') ? 'Student Fee Details' : 'Dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Hover-expand: previews the full sidebar over a manually-collapsed one
  // without touching the persistent isCollapsed preference. effectiveCollapsed
  // (derived below, after expandedItems) is what the render actually uses.
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  const handleSidebarMouseEnter = () => {
    if (!isCollapsed) return;
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsHoverExpanded(true);
  };

  const handleSidebarMouseLeave = () => {
    if (!isCollapsed) return;
    collapseTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(false);
      collapseTimeoutRef.current = null;
    }, HOVER_COLLAPSE_DELAY_MS);
  };

  const effectiveCollapsed = isCollapsed && !isHoverExpanded;
  // Auto-expand menu items based on current route
  const getInitialExpanded = () => {
    const expanded: string[] = [];
    menuGroups.forEach(group => {
      group.items.forEach(item => {
        if (item.children) {
          const isChildActive = item.children.some(child => 
            location.pathname === child.href || location.pathname.startsWith(child.href + '/')
          );
          if (isChildActive) expanded.push(item.label);
        }
      });
    });
    return expanded;
  };
  const [expandedItems, setExpandedItems] = useState<string[]>(getInitialExpanded);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');
  const isExactActive = (href: string) => location.pathname === href;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!effectiveCollapsed && (
          <div className="flex items-center gap-3">
            {displaySchoolLogo ? (
              <img src={displaySchoolLogo} alt={displaySchoolName || 'School'} className="w-9 h-9 object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <School className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">{displaySchoolName}</p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">{isImpersonating ? 'Viewing as Admin' : 'School Admin'}</p>
            </div>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon-sm" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent hidden md:flex"
        >
          {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
        <div className="space-y-3">
          {menuGroups.map((section) => {
            const visibleItems = section.items.filter(item => {
              const pathSegment = item.href.replace('/admin', '');
              return hasPathAccess(pathSegment);
            });
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.group || 'top'}>
                {section.group && !effectiveCollapsed && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                    {section.group}
                  </p>
                )}
                {section.group && effectiveCollapsed && (
                  <div className="mx-auto my-1.5 w-6 border-t border-sidebar-border/50" />
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <li key={item.label}>
                      {item.children ? (
                        <div>
                          <button
                            onClick={() => toggleExpanded(item.label)}
                            className={cn(
                              "nav-item w-full justify-between",
                              isActive(item.href) && "nav-item-active"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="w-5 h-5 shrink-0" />
                              {!effectiveCollapsed && <span>{t(labelToKey[item.label] || item.label)}</span>}
                            </div>
                            {!effectiveCollapsed && (
                              expandedItems.includes(item.label)
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          {!effectiveCollapsed && expandedItems.includes(item.label) && (
                            <ul className="mt-1 ml-8 space-y-1">
                              {item.children.map((child) => (
                                <li key={child.href}>
                                  <Link
                                    to={child.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                      "block py-2 px-3 rounded-md text-sm transition-colors",
                                      isExactActive(child.href)
                                        ? "text-sidebar-primary bg-sidebar-accent"
                                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                                    )}
                                  >
                                    {t(labelToKey[child.label] || child.label)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <Link
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "nav-item",
                            isActive(item.href) && "nav-item-active"
                          )}
                          title={effectiveCollapsed ? t(labelToKey[item.label] || item.label) : undefined}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          {!effectiveCollapsed && <span>{t(labelToKey[item.label] || item.label)}</span>}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className={cn(
          "flex items-center gap-3 cursor-pointer",
          effectiveCollapsed && "justify-center"
        )}
        onClick={() => { navigate('/admin/profile'); setMobileMenuOpen(false); }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user?.name || 'User'} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium text-sidebar-accent-foreground">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </div>
          )}
          {!effectiveCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user?.name}</p>
              <button 
                onClick={handleLogout}
                className="text-xs text-sidebar-foreground/70 hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                {t('sidebar.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar - Desktop */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground h-screen sticky top-0 transition-all duration-300 z-40",
          effectiveCollapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 h-full bg-sidebar animate-slide-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile close button */}
            <div className="absolute top-3 right-3 z-10">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Impersonation Banner */}
        <ImpersonationBanner />
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon-sm" 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
              {title && (
                <h1 className="text-lg md:text-xl font-display font-semibold text-foreground">
                  {title}
                </h1>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <NotificationDropdown />
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
