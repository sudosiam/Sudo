import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar } from './ui/misc';
import { cn } from '../lib/utils';
import { haptic } from '../lib/haptics';

/**
 * Compact 2-line list row with avatar — the standard row used by
 * sales, purchases, parties, payments, etc.
 */
export function ListRow({
  to,
  avatarName,
  avatar,
  title,
  subtitle,
  right,
  rightSub,
  trailing,
  className,
}: {
  to?: string;
  avatarName?: string;
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {avatar ?? (avatarName !== undefined && <Avatar name={avatarName} />)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-5 tracking-tight">{title}</p>
        {subtitle && (
          <p className="truncate text-xs leading-4 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {right && <div className="text-sm font-semibold leading-5 tabular-nums tracking-tight">{right}</div>}
        {rightSub && <div className="text-[11px] leading-4 text-muted-foreground">{rightSub}</div>}
      </div>
      {trailing}
      {to && <ChevronRight className="size-4 shrink-0 text-muted-foreground/45" />}
    </>
  );

  const cls = cn(
    'flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left last:border-b-0 sm:gap-3',
    to && 'transition-colors hover:bg-accent/45 active:bg-accent/70',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cls} onClick={() => haptic()}>
        {content}
      </Link>
    );
  }
  return <div className={cls}>{content}</div>;
}

export function ListCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('app-surface overflow-hidden', className)}>
      {children}
    </div>
  );
}
