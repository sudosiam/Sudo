import * as React from 'react';
import { cn } from '../../lib/utils';

/** Compact stat pills for list page toolbars (beside New / action buttons). */
export function PageKpis({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-1.5', className)}>
      {children}
    </div>
  );
}

export function PageKpi({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'success' | 'destructive' | 'muted';
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-[11px] font-semibold leading-none tracking-tight',
        tone === 'success' && 'border-success/25 bg-success/10 text-success',
        tone === 'destructive' && 'border-destructive/25 bg-destructive/10 text-destructive',
        tone === 'muted' && 'font-medium text-muted-foreground',
        !tone && 'tabular-nums',
      )}
    >
      {children}
    </span>
  );
}
