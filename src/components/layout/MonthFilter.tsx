import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useMonthFilter } from '../../stores/ui';
import { formatMonthKey, shiftMonth, currentMonthKey } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

const MONTH_FILTER_EXACT = new Set([
  '/',
  '/sales',
  '/purchases',
  '/payments',
  '/expenses',
  '/income',
  '/ledger',
]);

const MONTH_FILTER_REPORTS = new Set([
  'trial-balance',
  'balance-sheet',
  'profit-loss',
  'sales',
  'purchases',
  'expenses',
]);

/** Routes where the global month filter affects visible data. */
export function pathnameUsesMonthFilter(pathname: string): boolean {
  if (MONTH_FILTER_EXACT.has(pathname)) return true;
  if (/^\/banking\/[^/]+$/.test(pathname)) return true;
  const report = pathname.match(/^\/reports\/([^/]+)$/)?.[1];
  if (report && MONTH_FILTER_REPORTS.has(report)) return true;
  return false;
}

/** Global month filter pill shown in the app header */
export function MonthFilter({ className }: { className?: string }) {
  const { mode, month, setMonth, setMode } = useMonthFilter();
  const shortMonth = formatMonthKey(month).split(' ')[0] ?? formatMonthKey(month);

  return (
    <div className={cn('app-surface-muted inline-flex h-8 items-center gap-0.5 rounded-xl px-0.5', className)}>
      <button
        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => {
          haptic();
          setMonth(shiftMonth(month, -1));
        }}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <button
        className={cn(
          'flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold leading-none sm:px-2',
          mode === 'month' ? 'text-foreground' : 'text-muted-foreground',
        )}
        onClick={() => {
          haptic();
          if (mode === 'all') {
            setMode('month');
            setMonth(currentMonthKey());
          } else {
            setMode('all');
          }
        }}
        title="Toggle between month view and all time"
      >
        <CalendarDays className="size-3" />
        <span className="hidden min-[480px]:inline">
          {mode === 'all' ? 'All time' : formatMonthKey(month)}
        </span>
        <span className="min-[480px]:hidden">{mode === 'all' ? 'All' : shortMonth}</span>
      </button>
      <button
        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => {
          haptic();
          setMonth(shiftMonth(month, 1));
        }}
        aria-label="Next month"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}
