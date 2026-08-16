import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';
import { prefetchForPath } from '@/lib/prefetch-helpers';
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
  Shield,
  UserCheck,
  ScrollText,
  Upload,
  Video,
  Bus,
  
  Image,
  MessageSquare,
  HelpCircle,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import appLogo from '@/assets/logo.png';
import { useMyAdminPermissions, PATH_TO_MODULE } from '@/hooks/useAdminPermissions';
import { SwitchSchoolControl } from './SwitchSchoolControl';

const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिन्दी', short: 'HI' },
  { code: 'te', label: 'తెలుగు', short: 'TE' },
  { code: 'kn', label: 'ಕನ್ನಡ', short: 'KN' },
  { code: 'ta', label: 'தமிழ்', short: 'TA' },
  { code: 'mr', label: 'मराठी', short: 'MR' },
  { code: 'bn', label: 'বাংলা', short: 'BN' },
  { code: 'ml', label: 'മലയാളം', short: 'ML' },
];

interface SidebarProps {
  userRole?: 'super_admin' | 'school_admin' | 'teacher' | 'parent' | 'student';
  schoolName?: string;
  userName?: string;
  isMobileOverlay?: boolean;
  onMobileClose?: () => void;
}

// Route prefixes for each role
const rolePrefix = {
  super_admin: '/super-admin',
  school_admin: '/admin',
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
};

// Translation key mapping for menu labels
const labelToKey: Record<string, string> = {
  'Dashboard': 'sidebar.dashboard',
  'Students': 'sidebar.students',
  'Teachers': 'sidebar.teachers',
  'Classes': 'sidebar.classes',
  'Attendance': 'sidebar.attendance',
  'Fees': 'sidebar.fees',
  'Exams': 'sidebar.exams',
  'Online Classes': 'sidebar.onlineClasses',
  'Transport': 'sidebar.transport',
  
  'Academic Years': 'sidebar.academicYears',
  'Timetable': 'sidebar.timetable',
  'Announcements': 'sidebar.announcements',
  'Bulk Upload': 'sidebar.bulkUpload',
  'Gallery': 'sidebar.gallery',
  'Feedback': 'sidebar.feedback',
  'Queries': 'sidebar.queries',
  'Reports': 'sidebar.reports',
  'Subscription': 'sidebar.subscription',
  'Subscriptions': 'sidebar.subscriptions',
  'Settings': 'sidebar.settings',
  'Homework': 'sidebar.homework',
  'Marks': 'sidebar.marks',
  'Profile': 'sidebar.profile',
  'Results': 'sidebar.results',
  'Schools': 'sidebar.schools',
  'School Admins': 'sidebar.schoolAdmins',
  'Platform Users': 'sidebar.platformUsers',
  'Audit Logs': 'sidebar.auditLogs',
  'Holiday Calendar': 'sidebar.holidayCalendar',
  'My Profile': 'sidebar.myProfile',
};

// Grouped menu config for school_admin
interface MenuItem {
  label: string;
  path: string;
  icon: any;
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

const schoolAdminGrouped: MenuGroup[] = [
  {
    group: '',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Core',
    items: [
      { label: 'Students', path: '/students', icon: Users },
      { label: 'Teachers', path: '/teachers', icon: GraduationCap },
      { label: 'Classes', path: '/classes', icon: BookOpen },
      { label: 'Fees', path: '/fees', icon: CreditCard },
      { label: 'Attendance', path: '/attendance', icon: ClipboardList },
    ],
  },
  {
    group: 'Academic',
    items: [
      { label: 'Exams', path: '/exams', icon: FileText },
      { label: 'Timetable', path: '/timetable', icon: Clock },
      { label: 'Online Classes', path: '/online-classes', icon: Video },
      { label: 'Academic Years', path: '/academic-years', icon: Calendar },
    ],
  },
  {
    group: 'Communication',
    items: [
      { label: 'Announcements', path: '/announcements', icon: Bell },
      { label: 'Feedback', path: '/feedback', icon: MessageSquare },
      { label: 'Queries', path: '/queries', icon: HelpCircle },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Reports', path: '/reports', icon: BarChart3 },
      { label: 'Gallery', path: '/gallery', icon: Image },
      { label: 'Transport', path: '/transport', icon: Bus },
      { label: 'Bulk Upload', path: '/bulk-upload', icon: Upload },
      { label: 'Subscription', path: '/subscription', icon: CreditCard },
      { label: 'Settings', path: '/settings', icon: Settings },
      { label: 'My Profile', path: '/profile', icon: Users },
    ],
  },
];

// Flat menu items for non-admin roles
const menuConfig: Record<string, MenuItem[]> = {
  super_admin: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Schools', path: '/schools', icon: School },
    { label: 'School Admins', path: '/admins', icon: UserCheck },
    { label: 'Platform Users', path: '/platform-users', icon: Shield },
    { label: 'Subscriptions', path: '/subscriptions', icon: CreditCard },
    { label: 'Announcements', path: '/announcements', icon: Bell },
    { label: 'Audit Logs', path: '/audit-logs', icon: ScrollText },
    { label: 'Settings', path: '/settings', icon: Settings },
  ],
  teacher: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Students', path: '/students', icon: Users },
    { label: 'Attendance', path: '/attendance', icon: ClipboardList },
    { label: 'Homework', path: '/homework', icon: FileText },
    { label: 'Marks', path: '/marks', icon: BarChart3 },
    { label: 'Online Classes', path: '/online-classes', icon: Video },
    { label: 'Timetable', path: '/timetable', icon: Clock },
    { label: 'Announcements', path: '/announcements', icon: Bell },
    { label: 'Feedback', path: '/feedback', icon: MessageSquare },
    { label: 'Queries', path: '/queries', icon: HelpCircle },
    { label: 'Profile', path: '/profile', icon: GraduationCap },
  ],
  parent: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', path: '/attendance', icon: ClipboardList },
    { label: 'Homework', path: '/homework', icon: BookOpen },
    { label: 'Fees', path: '/fees', icon: CreditCard },
    { label: 'Results', path: '/results', icon: BarChart3 },
    { label: 'Online Classes', path: '/online-classes', icon: Video },
    { label: 'Transport', path: '/transport', icon: Bus },
    { label: 'Announcements', path: '/announcements', icon: Bell },
    { label: 'Gallery', path: '/gallery', icon: Image },
    { label: 'Feedback', path: '/feedback', icon: MessageSquare },
    { label: 'Queries', path: '/queries', icon: HelpCircle },
    { label: 'Profile', path: '/profile', icon: Users },
  ],
  student: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', path: '/attendance', icon: ClipboardList },
    { label: 'Homework', path: '/homework', icon: FileText },
    { label: 'Timetable', path: '/timetable', icon: Clock },
    { label: 'Results', path: '/results', icon: BarChart3 },
    { label: 'Online Classes', path: '/online-classes', icon: Video },
    { label: 'Transport', path: '/transport', icon: Bus },
    { label: 'Announcements', path: '/announcements', icon: Bell },
    { label: 'Gallery', path: '/gallery', icon: Image },
    { label: 'Profile', path: '/profile', icon: GraduationCap },
  ],
};

export function Sidebar({ userRole = 'school_admin', schoolName = 'Our School Tech', userName = 'Rajesh Kumar', isMobileOverlay, onMobileClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };
  const location = useLocation();
  const { logout } = useAuth();
  const { tenant, isSubdomain } = useTenant();
  const queryClient = useQueryClient();
  const effectiveSchoolId = useEffectiveSchoolId();

  // Use tenant branding on subdomains
  const displayLogo = isSubdomain && tenant?.logo ? tenant.logo : appLogo;
  const displayName = isSubdomain && tenant ? tenant.name : (userRole === 'super_admin' ? 'Super Admin' : schoolName);

  const prefix = rolePrefix[userRole];

  const { t, i18n } = useTranslation();
  const { hasPathAccess } = useMyAdminPermissions();

  const handleLinkHover = useCallback((path: string) => {
    prefetchForPath(path, effectiveSchoolId, queryClient);
  }, [effectiveSchoolId, queryClient]);

  const getFullPath = (path: string) => `${prefix}${path}`;

  const isActive = (path: string) => {
    const fullPath = getFullPath(path);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('app-language', code);
    const langLabel = LANGUAGES.find(l => l.code === code)?.label || code;
    toast.success(`Language set to ${langLabel}`);
  };

  return (
    <aside 
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground h-screen sticky top-0 transition-all duration-300 z-40",
        isMobileOverlay ? "w-64" : "hidden md:flex",
        !isMobileOverlay && (isCollapsed ? "w-16" : "w-64")
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              <img src={displayLogo} alt={displayName} className="w-10 h-10 object-contain drop-shadow-md" loading="eager" fetchPriority="high" decoding="sync" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon-sm" 
          onClick={toggleCollapsed}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
        {userRole === 'school_admin' ? (
          /* Grouped navigation for school admin */
          <div className="space-y-3">
            {schoolAdminGrouped.map((section) => {
              // Filter items based on permissions
              const visibleItems = section.items.filter(item => hasPathAccess(item.path));
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.group || 'top'}>
                  {section.group && !isCollapsed && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                      {section.group}
                    </p>
                  )}
                  {section.group && isCollapsed && (
                    <div className="mx-auto my-1.5 w-6 border-t border-sidebar-border/50" />
                  )}
                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const translatedLabel = t(labelToKey[item.label] || item.label);
                      return (
                        <li key={item.label}>
                          <Link
                            to={getFullPath(item.path)}
                            className={cn(
                              "nav-item",
                              isActive(item.path) && "nav-item-active"
                            )}
                            title={isCollapsed ? translatedLabel : undefined}
                            onClick={onMobileClose}
                            onMouseEnter={() => handleLinkHover(item.path)}
                          >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!isCollapsed && <span>{translatedLabel}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          /* Flat navigation for other roles */
          <ul className="space-y-0.5">
            {(menuConfig[userRole] || []).map((item) => {
              const translatedLabel = t(labelToKey[item.label] || item.label);
              return (
                <li key={item.label}>
                  <Link
                    to={getFullPath(item.path)}
                    className={cn(
                      "nav-item",
                      isActive(item.path) && "nav-item-active"
                    )}
                    title={isCollapsed ? translatedLabel : undefined}
                    onClick={onMobileClose}
                    onMouseEnter={() => handleLinkHover(item.path)}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span>{translatedLabel}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border">
        <SwitchSchoolControl isCollapsed={isCollapsed} />

        {/* Devices & Sessions */}
        <Link
          to="/security"
          className={cn(
            "nav-item w-full mx-2 mt-1",
            isCollapsed && "justify-center mx-auto"
          )}
          title={isCollapsed ? 'Devices & Sessions' : undefined}
        >
          <ShieldCheck className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Devices & Sessions</span>}
        </Link>

        {/* Language Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "nav-item w-full mx-2 mt-2",
                isCollapsed && "justify-center mx-auto"
              )}
              title={isCollapsed ? 'Language' : undefined}
            >
              <Globe className="w-5 h-5 shrink-0" />
              {!isCollapsed && (
                <span>{LANGUAGES.find(l => l.code === i18n.language)?.label || 'English'}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-44 p-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  i18n.language === lang.code
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {lang.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* User & Sign Out */}
        <div className={cn(
          "flex items-center gap-3 p-3",
          isCollapsed && "justify-center"
        )}>
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center">
            <img src={displayLogo} alt={displayName} className="w-9 h-9 object-contain" loading="eager" fetchPriority="high" decoding="sync" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{userName}</p>
              <button 
                onClick={logout}
                className="text-xs text-sidebar-foreground/70 hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                {t('sidebar.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
