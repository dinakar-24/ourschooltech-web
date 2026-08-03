import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';
import { Building2, MapPin, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface RawSchool {
  id: string;
  name: string;
  schoolCode: string;
  city: string | null;
  isActive: boolean;
  isSuspended: boolean;
  subscriptionPlan: string | null;
  createdAt: string;
}

export function RecentSchoolsList() {
  const { data: schools, isLoading } = useQuery({
    queryKey: ['recent-schools-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<{ schools: RawSchool[] }>('/superadmin/schools', {
        params: { limit: 5 },
      });
      return data.schools.map(s => ({
        id: s.id,
        name: s.name,
        code: s.schoolCode,
        city: s.city,
        is_active: s.isActive && !s.isSuspended,
        subscription_status: s.subscriptionPlan,
        created_at: s.createdAt,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!schools?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No schools registered yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {schools.map((school) => (
        <Link
          key={school.id}
          to="/super-admin/schools"
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{school.name}</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {school.code}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {school.city}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(school.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <StatusDot status={school.subscription_status} />
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: string | null }) {
  const color = status === 'active'
    ? 'bg-success'
    : status === 'trial'
      ? 'bg-warning'
      : 'bg-muted-foreground/40';
  const label = status || 'none';

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground capitalize">{label}</span>
    </div>
  );
}
