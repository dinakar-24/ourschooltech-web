import { useState } from 'react';
import { TimetableEntry, DAYS_OF_WEEK, useUpsertTimetableEntry, useDeleteTimetableEntry } from '@/hooks/useTimetableEntries';
import { PeriodEditDialog } from './PeriodEditDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, X, Coffee, PlusCircle } from 'lucide-react';

interface TimetableEditorProps {
  entries: TimetableEntry[];
  classId: string;
  sectionId: string;
  maxPeriod: number;
  onMaxPeriodChange: (n: number) => void;
}

export function TimetableEditor({ entries, classId, sectionId, maxPeriod, onMaxPeriodChange }: TimetableEditorProps) {
  const upsertMutation = useUpsertTimetableEntry();
  const deleteMutation = useDeleteTimetableEntry();

  const [editState, setEditState] = useState<{
    open: boolean;
    period: number;
    day: string;
    entry?: TimetableEntry;
  }>({ open: false, period: 1, day: 'Monday' });

  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  // Build lookup
  const grid: Record<number, Record<string, TimetableEntry>> = {};
  entries.forEach(e => {
    if (!grid[e.period_number]) grid[e.period_number] = {};
    grid[e.period_number][e.day_of_week] = e;
  });

  const isLunchPeriod = (period: number) => {
    return Object.values(grid[period] || {}).some(e => e.is_lunch);
  };

  const getPeriodTime = (period: number) => {
    const anyEntry = Object.values(grid[period] || {})[0];
    if (anyEntry) return `${anyEntry.start_time} - ${anyEntry.end_time}`;
    return '';
  };

  const handleCellClick = (period: number, day: string) => {
    const entry = grid[period]?.[day];
    setEditState({
      open: true,
      period,
      day,
      entry: entry || undefined,
    });
  };

  const handleSave = (data: {
    subject_id: string | null;
    teacher_id: string | null;
    start_time: string;
    end_time: string;
    is_lunch: boolean;
    apply_all_days: boolean;
  }) => {
    upsertMutation.mutate({
      section_id: sectionId,
      period_number: editState.period,
      day_of_week: editState.day,
      ...data,
    }, {
      onSuccess: () => setEditState(s => ({ ...s, open: false })),
    });
  };

  const handleDelete = (entry: TimetableEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate(entry.id);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b border-r border-border px-3 py-2.5 text-left font-semibold text-muted-foreground w-[100px]">
                Period
              </th>
              {DAYS_OF_WEEK.map(day => (
                <th key={day} className="border-b border-r last:border-r-0 border-border px-3 py-2.5 text-center font-semibold text-muted-foreground">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => {
              const lunch = isLunchPeriod(period);
              const time = getPeriodTime(period);

              if (lunch) {
                return (
                  <tr key={period} className="bg-amber-50 dark:bg-amber-950/20 cursor-pointer" onClick={() => handleCellClick(period, 'Monday')}>
                    <td className="border-b border-r border-border px-3 py-2 text-center" colSpan={DAYS_OF_WEEK.length + 1}>
                      <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                        <Coffee className="w-4 h-4" />
                        LUNCH BREAK
                        {time && <span className="text-xs font-normal text-amber-600/70 dark:text-amber-500/70">({time})</span>}
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={period} className="hover:bg-muted/30 transition-colors">
                  <td className="border-b border-r border-border px-3 py-2">
                    <div className="font-medium text-foreground">Period {period}</div>
                    {time && <div className="text-[11px] text-muted-foreground">{time}</div>}
                  </td>
                  {DAYS_OF_WEEK.map(day => {
                    const entry = grid[period]?.[day];
                    return (
                      <td
                        key={day}
                        className={cn(
                          "border-b border-r last:border-r-0 border-border px-2 py-1.5 text-center cursor-pointer relative group",
                          "hover:bg-primary/5 transition-colors"
                        )}
                        onClick={() => handleCellClick(period, day)}
                      >
                        {entry ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-foreground text-xs leading-tight">{entry.subject}</div>
                            {entry.teacher && (
                              <div className="text-[10px] text-muted-foreground leading-tight">{entry.teacher.full_name}</div>
                            )}
                            <button
                              onClick={(e) => handleDelete(entry, e)}
                              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <Plus className="w-4 h-4 mx-auto text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onMaxPeriodChange(maxPeriod + 1)}
        className="gap-1.5"
      >
        <PlusCircle className="w-4 h-4" />
        Add Period
      </Button>

      <PeriodEditDialog
        open={editState.open}
        onOpenChange={(o) => setEditState(s => ({ ...s, open: o }))}
        onSave={handleSave}
        isSaving={upsertMutation.isPending}
        initialData={editState.entry ? {
          subject_id: editState.entry.subject_id,
          teacher_id: editState.entry.teacher_id,
          start_time: editState.entry.start_time,
          end_time: editState.entry.end_time,
          is_lunch: editState.entry.is_lunch,
        } : undefined}
        periodNumber={editState.period}
        dayOfWeek={editState.day}
        classId={classId}
      />
    </div>
  );
}
