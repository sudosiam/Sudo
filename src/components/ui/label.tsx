import * as React from 'react';
import { cn } from '../../lib/utils';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-[11px] font-semibold tracking-wide text-muted-foreground/95 select-none', className)}
      {...props}
    />
  );
}
