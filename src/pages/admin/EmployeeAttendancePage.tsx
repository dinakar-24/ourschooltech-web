import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  CalendarIcon, Check, X, Clock, Save, Search, Loader2, Users, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeacherAttendance } from '@/hooks/useTeacherAttendance';

type Status = 'present' | 'absent' | 'late' | 'half_day';

const STATUS_CONFIG: { key: Status; label: string; shortLabel: string; color: string; activeColor: string; icon: typeof Check }[] = [
  { key: 'present', label: 'Present', shortLabel: 'P', color: 'text-success', activeColor: 'bg-success text-success-foreground shadow-sm', icon: Check },
  { key: 'absent', label: 'Absent', shortLabel: 'A', color: 'text-destructive', activeColor: 'bg-destructive text-destructive-foreground shadow-sm', icon: X },
  { key: 'late', label: 'Late', shortLabel: 'L', color: 'text-warning', activeColor: 'bg-warning text-warning-foreground shadow-sm', icon: Clock },
  { key: 'half_day', label: 'Half Day', shortLabel: 'HD', color: 'text-info', activeColor: 'bg-info text-info-foreground shadow-sm', icon: Clock },
];

export default function EmployeeAttendancePage() {
  const isMobile = useIsMobile();
  const [date, setDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [localStatuses, setLocalStatuses] = useState<Record<string, Status>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, saveAttendance } = useTeacherAttendance(date);
  const teachers = data?.teachers || [];
  const records = data?.records || [];

  const statusMap = useMemo(() => {
    const map: Record<string, Status> = {};
    records.forEach(r => { map[r.teacher_id] = r.status as Status; });
    Object.assign(map, localStatuses);
    return map;
  }, [records, localStatuses]);

  const filtered = teachers.filter(t =>
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateStatus = (teacherId: string, status: Status) => {
    setLocalStatuses(prev => ({ ...prev, [teacherId]: status }));
    setHasChanges(true);
  };

  const markAllPresent = () => {
    const all: Record<string, Status> = {};
    teachers.forEach(t => { all[t.id] = 'present'; });
    setLocalStatuses(all);
    setHasChanges(true);
  };

  const handleSave = () => {
    const entries = teachers
      .filter(t => statusMap[t.id])
      .map(t => ({ teacher_id: t.id, status: statusMap[t.id] }));
    saveAttendance.mutate(entries, {
      onSuccess: () => { setLocalStatuses({}); setHasChanges(false); },
    });
  };

  const stats = useMemo(() => {
    const present = teachers.filter(t => statusMap[t.id] === 'present').length;
    const absent = teachers.filter(t => statusMap[t.id] === 'absent').length;
    const late = teachers.filter(t => statusMap[t.id] === 'late').length;
    const unmarked = teachers.filter(t => !statusMap[t.id]).length;
    return { present, absent, late, unmarked, total: teachers.length };
  }, [teachers, statusMap]);

  const STAT_CARDS = [
    { icon: Users, label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-muted/30' },
    { icon: CheckCircle, label: 'Present', value: stats.present, color: 'text-success', bg: 'bg-success/5' },
    { icon: XCircle, label: 'Absent', value: stats.absent, color: 'text-destructive', bg: 'bg-destructive/5' },
    { icon: Clock, label: 'Late', value: stats.late, color: 'text-warning', bg: 'bg-warning/5' },
    { icon: AlertCircle, label: 'Unmarked', value: stats.unmarked, color: 'text-muted-foreground', bg: 'bg-muted/20' },
  ];

  return (
      <div className="space-y-4 md:space-y-5 animate-fade-up">
        {/* Controls - stacked on mobile */}
        <div className="space-y-2.5 md:space-y-0 md:flex md:flex-row md:gap-3 md:justify-between md:items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 w-full md:w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {format(date, 'MMMM do, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search teacher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 w-full md:w-52 h-10 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={markAllPresent} className="h-9 w-full md:w-auto">
            <Check className="w-4 h-4 mr-1.5" />
            Mark All Present
          </Button>
        </div>

        {/* Stats - 2x2 grid on mobile with Unmarked spanning full width */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-3">
          {STAT_CARDS.map((s, i) => (
            <Card key={s.label} className={cn(
              "border",
              s.bg,
              // Last item (Unmarked) spans full width on mobile when odd count
              i === STAT_CARDS.length - 1 && STAT_CARDS.length % 2 !== 0 && "col-span-2 md:col-span-1"
            )}>
              <CardContent className="p-3 md:p-4 flex items-center gap-2.5 md:gap-3">
                <div className={cn("w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                  <s.icon className={cn("w-4 h-4 md:w-5 md:h-5", s.color)} />
                </div>
                <div>
                  <p className={cn("text-lg md:text-xl font-bold leading-none", s.color)}>{s.value}</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Teacher List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No teachers found</p>
                <p className="text-sm mt-1">Add teachers to start tracking attendance</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((teacher, idx) => {
                  const status = statusMap[teacher.id];
                  return (
                    <div
                      key={teacher.id}
                      className={cn(
                        "px-3 md:px-4 py-3 md:py-3.5 transition-colors",
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                        "hover:bg-muted/30"
                      )}
                    >
                      {/* Mobile: stack name and buttons vertically */}
                      <div className="flex items-center gap-2.5 md:gap-3">
                        {teacher.avatar_url ? (
                          <img src={teacher.avatar_url} alt="" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs md:text-sm font-semibold shrink-0">
                            {teacher.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{teacher.full_name}</p>
                          <p className="text-xs text-muted-foreground">{teacher.employee_id}</p>
                        </div>
                        {/* Status buttons */}
                        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                          {STATUS_CONFIG.map(s => (
                            <button
                              key={s.key}
                              onClick={() => updateStatus(teacher.id, s.key)}
                              className={cn(
                                "rounded-lg text-xs font-medium transition-all",
                                isMobile ? "w-8 h-8 flex items-center justify-center" : "px-3 py-1.5",
                                status === s.key
                                  ? s.activeColor
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {isMobile ? s.shortLabel : s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floating Save Button */}
        {hasChanges && (
          <div className="sticky bottom-20 md:bottom-6 z-20 flex justify-center px-4">
            <Button
              onClick={handleSave}
              disabled={saveAttendance.isPending}
              size="lg"
              className="shadow-lg w-full md:w-auto md:px-8"
            >
              {saveAttendance.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Attendance ({stats.total - stats.unmarked}/{stats.total})</>
              )}
            </Button>
          </div>
        )}
      </div>
  );
}
