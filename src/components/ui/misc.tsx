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
