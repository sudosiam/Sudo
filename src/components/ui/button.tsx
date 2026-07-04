import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none cursor-pointer touch-manipulation',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90',
        outline: 'border-border bg-card/80 text-foreground shadow-sm hover:bg-accent/80 hover:text-accent-foreground',
        secondary: 'border-border/70 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-success text-success-foreground shadow-md hover:bg-success/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
        'icon-sm': 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** disable the default tap haptic */
  noHaptic?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, noHaptic, onClick, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={(e) => {
        if (!noHaptic) haptic('tap');
        onClick?.(e);
      }}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
