import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, subDays, subWeeks, subMonths, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export type DateRangeOption = 
  | 'lifetime'
  | 'wtd'
  | 'mtd'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_week'
  | 'custom';

export interface DateRange {
  startDate: Date | null;
  endDate: Date;
  label: string;
}

export interface CustomDateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const dateRangeOptions: { value: DateRangeOption; label: string }[] = [
  { value: 'mtd', label: 'Month to Date' },
  { value: 'wtd', label: 'Week to Date' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'lifetime', label: 'Lifetime' },
];

export function getDateRange(option: DateRangeOption, customRange?: CustomDateRange): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (option) {
    case 'lifetime':
      return { startDate: null, endDate: today, label: 'Lifetime' };
    case 'wtd':
      return { startDate: startOfWeek(today, { weekStartsOn: 1 }), endDate: today, label: 'Week to Date' };
    case 'mtd':
      return { startDate: startOfMonth(today), endDate: today, label: 'Month to Date' };
    case 'last_7_days':
      return { startDate: subDays(today, 7), endDate: today, label: 'Last 7 Days' };
    case 'last_30_days':
      return { startDate: subDays(today, 30), endDate: today, label: 'Last 30 Days' };
    case 'last_week': {
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
      return { startDate: lastWeekStart, endDate: lastWeekEnd, label: 'Last Week' };
    }
    case 'custom': {
      if (customRange?.from && customRange?.to) {
        const label = `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d, yyyy')}`;
        return { startDate: customRange.from, endDate: customRange.to, label };
      }
      return { startDate: null, endDate: today, label: 'Custom' };
    }
    default:
      return { startDate: null, endDate: today, label: 'Lifetime' };
  }
}

export function getPreviousPeriod(option: DateRangeOption, customRange?: CustomDateRange): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (option) {
    case 'lifetime':
      return null;
    case 'wtd': {
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      const daysIntoWeek = differenceInDays(today, currentWeekStart);
      const prevWeekStart = subWeeks(currentWeekStart, 1);
      const prevWeekEnd = subDays(prevWeekStart, -daysIntoWeek);
      return { startDate: prevWeekStart, endDate: prevWeekEnd, label: 'Previous Week' };
    }
    case 'mtd': {
      const currentMonthStart = startOfMonth(today);
      const daysIntoMonth = differenceInDays(today, currentMonthStart);
      const prevMonthStart = startOfMonth(subMonths(today, 1));
      const prevMonthEnd = subDays(prevMonthStart, -daysIntoMonth);
      return { startDate: prevMonthStart, endDate: prevMonthEnd, label: 'Previous Month' };
    }
    case 'last_7_days': {
      const periodStart = subDays(today, 7);
      const prevEnd = subDays(periodStart, 1);
      const prevStart = subDays(prevEnd, 6);
      return { startDate: prevStart, endDate: prevEnd, label: 'Previous 7 Days' };
    }
    case 'last_30_days': {
      const periodStart = subDays(today, 30);
      const prevEnd = subDays(periodStart, 1);
      const prevStart = subDays(prevEnd, 29);
      return { startDate: prevStart, endDate: prevEnd, label: 'Previous 30 Days' };
    }
    case 'last_week': {
      const prevWeekStart = startOfWeek(subWeeks(today, 2), { weekStartsOn: 1 });
      const prevWeekEnd = endOfWeek(subWeeks(today, 2), { weekStartsOn: 1 });
      return { startDate: prevWeekStart, endDate: prevWeekEnd, label: 'Week Before' };
    }
    case 'custom': {
      if (customRange?.from && customRange?.to) {
        const duration = differenceInDays(customRange.to, customRange.from);
        const prevEnd = subDays(customRange.from, 1);
        const prevStart = subDays(prevEnd, duration);
        return { startDate: prevStart, endDate: prevEnd, label: 'Previous Period' };
      }
      return null;
    }
    default:
      return null;
  }
}

interface DateRangeFilterProps {
  selectedOption: DateRangeOption;
  onChange: (option: DateRangeOption) => void;
  customRange?: CustomDateRange;
  onCustomRangeChange?: (range: CustomDateRange) => void;
}

export function DateRangeFilter({ 
  selectedOption, 
  onChange,
  customRange,
  onCustomRangeChange,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectionState, setSelectionState] = useState<'start' | 'end'>('start');
  const [tempRange, setTempRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  
  const getLabel = () => {
    if (selectedOption === 'custom' && customRange?.from && customRange?.to) {
      return `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d')}`;
    }
    return dateRangeOptions.find(o => o.value === selectedOption)?.label || 'Month to Date';
  };

  const handleOptionSelect = (option: DateRangeOption) => {
    onChange(option);
    setOpen(false);
    setShowCalendar(false);
  };

  const handleCustomClick = () => {
    setShowCalendar(true);
    setSelectionState('start');
    setTempRange({ from: customRange?.from, to: customRange?.to });
  };

  const handleDayClick = (day: Date) => {
    if (selectionState === 'start') {
      // First click sets start date
      setTempRange({ from: day, to: undefined });
      setSelectionState('end');
    } else {
      // Second click sets end date
      if (tempRange.from && day >= tempRange.from) {
        const newRange = { from: tempRange.from, to: day };
        setTempRange(newRange);
        onCustomRangeChange?.(newRange);
        onChange('custom');
        setOpen(false);
        setShowCalendar(false);
        setSelectionState('start');
      } else if (tempRange.from && day < tempRange.from) {
        // If clicked date is before start, reset and use as new start
        setTempRange({ from: day, to: undefined });
        setSelectionState('end');
      }
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setShowCalendar(false);
      setSelectionState('start');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {getLabel()}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "p-0 z-50 bg-popover",
          showCalendar ? "w-auto" : "w-48"
        )}
        align="end"
      >
        {!showCalendar ? (
          <div className="py-1">
            {dateRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                  selectedOption === option.value && "bg-accent"
                )}
              >
                {option.label}
              </button>
            ))}
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleCustomClick}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                selectedOption === 'custom' && "bg-accent"
              )}
            >
              Custom Range...
            </button>
          </div>
        ) : (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3 text-sm">
              <div className={cn(
                "flex-1 px-3 py-2 rounded border text-center",
                selectionState === 'start' ? "border-primary bg-primary/5" : "border-border"
              )}>
                <div className="text-xs text-muted-foreground mb-1">Start Date</div>
                <div className="font-medium">
                  {tempRange.from ? format(tempRange.from, 'MMM d, yyyy') : 'Select...'}
                </div>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className={cn(
                "flex-1 px-3 py-2 rounded border text-center",
                selectionState === 'end' ? "border-primary bg-primary/5" : "border-border"
              )}>
                <div className="text-xs text-muted-foreground mb-1">End Date</div>
                <div className="font-medium">
                  {tempRange.to ? format(tempRange.to, 'MMM d, yyyy') : 'Select...'}
                </div>
              </div>
            </div>
            <Calendar
              mode="single"
              selected={selectionState === 'start' ? tempRange.from : tempRange.to}
              onSelect={(day) => day && handleDayClick(day)}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
              className="pointer-events-auto"
              modifiers={{
                range_start: tempRange.from ? [tempRange.from] : [],
                range_end: tempRange.to ? [tempRange.to] : [],
                range_middle: tempRange.from && tempRange.to 
                  ? { after: tempRange.from, before: tempRange.to }
                  : undefined,
              }}
              modifiersClassNames={{
                range_start: "bg-primary text-primary-foreground rounded-l-md",
                range_end: "bg-primary text-primary-foreground rounded-r-md",
                range_middle: "bg-primary/20",
              }}
            />
            <div className="flex justify-between mt-3 pt-3 border-t">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCalendar(false)}
              >
                Back
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTempRange({ from: undefined, to: undefined });
                  setSelectionState('start');
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
