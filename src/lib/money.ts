/**
 * All money in the app is stored as integer paise (1 rupee = 100 paise).
 * These helpers are the single conversion point between paise and display/input.
 */

export type Paise = number;

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₹1,23,456.78 */
export function formatPaise(paise: Paise): string {
  return inrFormatter.format((paise ?? 0) / 100);
}

/** ₹1,23,457 — for KPI cards and compact rows (whole rupees) */
export function formatPaiseRounded(paise: Paise): string {
  return inrCompactFormatter.format(Math.round((paise ?? 0) / 100));
}

/** Format without currency symbol: 1,23,456.78 */
export function formatPaisePlain(paise: Paise): string {
  return ((paise ?? 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Parse a user-typed rupee string ("1,234.56") into integer paise. Returns 0 for invalid. */
export function parseRupees(input: string): Paise {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** Paise -> "1234.56" for editing in an input */
export function paiseToInput(paise: Paise): string {
  if (!paise) return '';
  return (paise / 100).toFixed(2).replace(/\.00$/, '');
}

/** Multiply qty (float ok) by unit price in paise, rounding to integer paise. */
export function mulQty(qty: number, unitPaise: Paise): Paise {
  return Math.round(qty * unitPaise);
}

/** Percentage of an amount, rounded to integer paise. pct is e.g. 12.5 */
export function pctOf(amount: Paise, pct: number): Paise {
  return Math.round((amount * pct) / 100);
}
