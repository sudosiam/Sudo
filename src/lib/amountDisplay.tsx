import { cn } from './utils';
import { formatPaise } from './money';

type Direction = 'in' | 'out' | 'debit' | 'credit';

function toneFor(direction: Direction): string {
  if (direction === 'in' || direction === 'debit') return 'text-success';
  return 'text-destructive';
}

function prefixFor(direction: Direction): string {
  if (direction === 'in') return '+';
  if (direction === 'out') return '−';
  return '';
}

/** Consistent signed amount coloring across lists and ledgers. */
export function SignedAmount({
  amount,
  direction,
  className,
  showSign = true,
}: {
  amount: number;
  direction: Direction;
  className?: string;
  showSign?: boolean;
}) {
  const abs = Math.abs(amount);
  const prefix = showSign ? prefixFor(direction) : '';
  return (
    <span className={cn('tabular-nums', toneFor(direction), className)}>
      {prefix}
      {formatPaise(abs)}
    </span>
  );
}
