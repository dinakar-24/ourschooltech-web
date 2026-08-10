import { CreditCard, UserPlus, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffectiveSchoolId } from '@/hooks/useEffectiveSchoolId';

export function TodaysSummary() {
  const schoolId = useEffectiveSchoolId();

  const { data } = useQuery({
    queryKey: ['today-summary', schoolId],
    queryFn: async () => {
      const { data } = await api.get('/school/reports/stats');
      return {
        feesCollected: Number(data?.todayFeesCollected ?? 0),
        newAdmissions: Number(data?.todayAdmissions ?? 0),
        noticesSent: Number(data?.todayNotices ?? 0),
      };
    },
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount}`;
  };

  const todayItems = [
    { 
      label: 'Fees Collected', 
      value: formatCurrency(data?.feesCollected ?? 0), 
      icon: CreditCard,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    { 
      label: 'New Admissions', 
      value: `${data?.newAdmissions ?? 0} students`, 
      icon: UserPlus,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      label: 'Notices Sent', 
      value: `${data?.noticesSent ?? 0} announcements`, 
      icon: Bell,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10'
    },
  ];

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">Today's Activity</h3>
      <div className="space-y-3">
        {todayItems.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
