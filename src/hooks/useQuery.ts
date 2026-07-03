/**
 * Reactive query hooks: PowerSync watch queries + TanStack Query caching.
 * Components re-render only when the underlying tables actually change.
 */
export { useQuery, useSuspenseQuery } from '@powersync/tanstack-react-query';
export { usePowerSync, useStatus } from '@powersync/react';

import { useMonthFilter, monthFilterRange } from '../stores/ui';

/** Active month range for SQL filters, or null when "All time" */
export function useMonthRange(): { start: string; end: string } | null {
  const mode = useMonthFilter((s) => s.mode);
  const month = useMonthFilter((s) => s.month);
  return monthFilterRange({ mode, month });
}

/** Builds a `date BETWEEN ? AND ?` clause fragment for the active month filter */
export function useDateClause(column = 'date'): { clause: string; params: string[] } {
  const range = useMonthRange();
  if (!range) return { clause: '1=1', params: [] };
  return { clause: `${column} BETWEEN ? AND ?`, params: [range.start, range.end] };
}
