import * as React from 'react';
import { cn } from '../../lib/utils';

export function LoadMoreButton({
  onClick,
  className,
  children = 'Load more',
}: {
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'mt-3 w-full rounded-xl border bg-card py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
