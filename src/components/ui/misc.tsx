import * as React from 'react';
import { cn, initials, avatarColor } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />;
}

export function PageSpinner() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Skeleton for a single `ListRow` — avatar + 2-line text + right-aligned amount. */
export function ListRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 last:border-b-0 sm:gap-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5 rounded" />
        <Skeleton className="h-3 w-1/4 rounded" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Skeleton className="h-3.5 w-14 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
    </div>
  );
}

/** Skeleton for a `ListCard` full of rows — the standard list-loading state. */
export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="app-surface overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for one KPI tile (Dashboard-style grid card). */
export function KpiCardSkeleton() {
  return (
    <div className="app-surface flex h-full flex-col justify-between p-3.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="size-4 rounded" />
      </div>
      <Skeleton className="mt-3 h-5 w-20 rounded" />
    </div>
  );
}

/** Skeleton for the compact `PageKpis` pill row shown next to list-page actions. */
export function PageKpisSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[22px] w-16 rounded-md" />
      ))}
    </div>
  );
}

/** Skeleton for a detail page: header card + a short list below it. */
export function DetailSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="app-surface space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-2/5 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="hidden h-14 rounded-xl sm:block" />
        </div>
      </div>
      <ListCardSkeleton rows={rows} />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const { bg, fg } = avatarColor(name || '?');
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials(name || '?')}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-surface-muted flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {icon && <div className="text-muted-foreground/55 [&_svg]:size-10">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {message && <p className="max-w-xs text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

import { haptic } from '../../lib/haptics';

/** Segmented control (e.g. Customer / Vendor filter) */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  scrollable,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  /** Horizontal scroll for long option lists (e.g. inventory categories). */
  scrollable?: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-xl border border-border bg-muted/65 p-1',
        scrollable ? 'scroll-touch overflow-x-auto flex-nowrap snap-x snap-mandatory' : 'flex-wrap',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value || '__all__'}
          type="button"
          onClick={() => {
            haptic();
            onChange(o.value);
          }}
          className={cn(
            'shrink-0 snap-start rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition-[color,background-color,box-shadow] duration-150 ease-out',
            value === o.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
