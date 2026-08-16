import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  School,
  Users,
  Bell,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
  Search,
  Shield,
  FileText,
  CreditCard,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearchDialog } from '@/components/super-admin/GlobalSearchDialog';
import { NotificationsDropdown } from '@/components/super-admin/NotificationsDropdown';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Schools', href: '/super-admin/schools', icon: School },
  { label: 'School Admins', href: '/super-admin/admins', icon: Users },
  { label: 'Platform Users', href: '/super-admin/platform-users', icon: Shield },
  { label: 'Announcements', href: '/super-admin/announcements', icon: Bell },
  { label: 'Reports', href: '/super-admin/reports', icon: BarChart3 },
  { label: 'Subscriptions', href: '/super-admin/subscriptions', icon: CreditCard },
  { label: 'System Health', href: '/super-admin/system-health', icon: Activity },
  { label: 'Audit Logs', href: '/super-admin/audit-logs', icon: FileText },
  { label: 'Settings', href: '/super-admin/settings', icon: Settings },
];

export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive flex items-center justify-center">
              <Shield className="w-5 h-5 text-destructive-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">Our School Tech</p>
              <p className="text-xs text-destructive font-medium">Super Admin</p>
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
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.label}>
              <Link
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "nav-item py-3 md:py-2",
                  isActive(item.href) && "nav-item-active"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="text-sm md:text-base">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        <Link
          to="/security"
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            "nav-item mb-2",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? 'Devices & Sessions' : undefined}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="text-sm">Devices & Sessions</span>}
        </Link>
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed && "justify-center"
        )}>
          <div className="w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center text-sm font-medium text-destructive">
            SA
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user?.name || 'Super Admin'}</p>
              <button 
                onClick={handleLogout}
                className="text-xs text-sidebar-foreground/70 hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign out
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
        className={cn(
          "hidden md:flex flex-col bg-sidebar text-sidebar-foreground h-screen sticky top-0 transition-all duration-300 z-40",
          isCollapsed ? "w-16" : "w-64"
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
            className="w-64 h-full bg-sidebar animate-slide-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border px-3 md:px-6 py-2 md:py-3">
          <div className="flex items-center justify-between gap-2 md:gap-4">
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
                <h1 className="text-base md:text-xl font-display font-semibold text-foreground truncate max-w-[180px] md:max-w-none">
                  {title}
                </h1>
              )}
            </div>
            
            <div className="flex items-center gap-1 md:gap-3">
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors w-64"
              >
                <Search className="w-4 h-4" />
                <span>Search...</span>
                <kbd className="ml-auto text-[10px] bg-background border rounded px-1.5 py-0.5">⌘K</kbd>
              </button>
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSearchOpen(true)}>
                <Search className="w-5 h-5" />
              </Button>
              <NotificationsDropdown />
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-3 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
