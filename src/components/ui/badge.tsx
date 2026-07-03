import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-primary/25 bg-primary/12 text-primary',
        secondary: 'border-secondary/40 bg-secondary text-secondary-foreground',
        success: 'border-success/35 bg-success/12 text-success',
        warning: 'border-warning/35 bg-warning/18 text-warning-foreground dark:text-warning',
        destructive: 'border-destructive/35 bg-destructive/10 text-destructive',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Paid / Partial / Credit status badge used across sales & purchases */
export function PayStatusBadge({ status }: { status: string }) {
  if (status === 'paid') return <Badge variant="success">Paid</Badge>;
  if (status === 'partial') return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="destructive">Credit</Badge>;
}
