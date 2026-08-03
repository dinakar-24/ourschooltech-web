import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateLocal(str: string): Date | undefined {
  if (!str) return undefined;
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

interface DOBPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

export function DOBPicker({ value, onChange, label = 'Date of Birth', required }: DOBPickerProps) {
  const [open, setOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= 1950; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const selectedDate = value ? parseDateLocal(value) : undefined;

  const [viewMonth, setViewMonth] = useState<Date>(selectedDate || new Date(currentYear - 10, 0, 1));

  const displayText = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2, '0')}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${selectedDate.getFullYear()}`
    : null;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatDateLocal(date));
      setOpen(false);
    }
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(viewMonth);
    newDate.setMonth(parseInt(month));
    setViewMonth(newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(viewMonth);
    newDate.setFullYear(parseInt(year));
    setViewMonth(newDate);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label} {required && <span className="text-destructive">*</span>}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-11 justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText || <span>dd-mm-yyyy</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
            <Select value={String(viewMonth.getMonth())} onValueChange={handleMonthChange}>
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(viewMonth.getFullYear())} onValueChange={handleYearChange}>
              <SelectTrigger className="h-8 w-[90px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            month={viewMonth}
            onMonthChange={setViewMonth}
            disabled={(date) => date > new Date() || date < new Date(1950, 0, 1)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
