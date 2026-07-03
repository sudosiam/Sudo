/**
 * Date helpers. Dates are stored as ISO strings (YYYY-MM-DD) in SQLite,
 * and months are addressed as "YYYY-MM" keys everywhere.
 */

export type MonthKey = string; // "2026-07"

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentMonthKey(): MonthKey {
  return todayISO().slice(0, 7);
}

export function monthKeyOf(isoDate: string): MonthKey {
  return isoDate.slice(0, 7);
}

/** First and last day (inclusive) of a month key */
export function monthRange(key: MonthKey): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${key}-01`, end: `${key}-${String(last).padStart(2, '0')}` };
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonthKey(key: MonthKey): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "2026-07-03" -> "3 Jul 2026" */
export function formatISODate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "2026-07-03" -> "3 Jul" (short, for compact lists) */
export function formatISODateShort(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** Day-of-month for a recurring expense within a month (clamped to month length). */
export function expenseDateInMonth(monthKey: MonthKey, dayOfMonth: number): string {
  const { end } = monthRange(monthKey);
  const lastDay = Number(end.slice(8, 10));
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

/** Last N month keys ending at (and including) the given key, oldest first. */
export function lastNMonths(n: number, endKey: MonthKey = currentMonthKey()): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(endKey, -i));
  return out;
}
