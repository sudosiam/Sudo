import * as React from 'react';
import { cn } from '../../lib/utils';

/** Horizontal scroll wrapper for wide tables on mobile. */
export function TableWrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('app-table-wrap', className)}>{children}</div>;
}
