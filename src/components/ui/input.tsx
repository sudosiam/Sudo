import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-card/85 px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow,background-color]',
        'placeholder:text-muted-foreground/80',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        type === 'number' && 'tabular-nums',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
