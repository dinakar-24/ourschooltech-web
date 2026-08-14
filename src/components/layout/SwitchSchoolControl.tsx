import { Building2, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMySchools } from '@/hooks/useMySchools';
import { useSwitchSchool } from '@/hooks/useSwitchSchool';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Administrator',
  teacher: 'Teacher',
  parent: 'Parent',
  student: 'Student',
};

// Only ever rendered inside Sidebar.tsx's bottom section -- the one place
// every role layout already shares, so this is the single spot a "Switch
// School" control needs to exist rather than one per role's layout.
// Self-contained: renders nothing at all unless the account actually has
// 2+ active memberships, so single-school users (the overwhelming common
// case) see zero change, same discipline as the login-time school picker.
export function SwitchSchoolControl({ isCollapsed }: { isCollapsed?: boolean }) {
  const { user } = useAuth();
  const { data: schools } = useMySchools();
  const { switchSchool, isSwitching } = useSwitchSchool();

  // Only list schools other than the one currently active -- clicking your
  // own current school would just re-issue an identical token, pure noise.
  const otherSchools = (schools ?? []).filter((s) => s.school_id !== user?.schoolId);

  if (otherSchools.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'nav-item w-full mx-2 mt-1',
            isCollapsed && 'justify-center mx-auto'
          )}
          disabled={isSwitching}
          title={isCollapsed ? 'Switch School' : undefined}
        >
          {isSwitching ? <Loader2 className="w-5 h-5 shrink-0 animate-spin" /> : <Building2 className="w-5 h-5 shrink-0" />}
          {!isCollapsed && <span>Switch School</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-64 p-1">
        {otherSchools.map((school) => (
          <button
            key={school.school_id}
            onClick={() => switchSchool(school.school_id)}
            disabled={isSwitching}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md hover:bg-muted text-foreground text-left disabled:opacity-50"
          >
            <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center">
              {school.logo_url ? (
                <img src={school.logo_url} alt={school.school_name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs font-bold text-muted-foreground">{school.school_name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{school.school_name}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[school.role] || school.role}</p>
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
