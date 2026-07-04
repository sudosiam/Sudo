/**
 * Reactive query hooks: local SQLite reads + TanStack Query caching.
 * Invalidates when local writes or Supabase Realtime events change data.
 */
import * as React from 'react';
import { useQuery as useTanstackQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../system/db';
import { subscribeQueryInvalidation } from '../system/queryBus';
import { useMonthFilter, monthFilterRange } from '../stores/ui';

export { db };

/** Local SQLite database — use for domain writes (createParty, etc.). */
export function useDb() {
  return db;
}

interface SqlQueryOptions {
  queryKey: unknown[];
  query: string;
  parameters?: unknown[];
  enabled?: boolean;
}

export function useQuery<T>(opts: SqlQueryOptions) {
  const queryClient = useQueryClient();
  const { queryKey, query, parameters = [], enabled = true } = opts;

  const serializedKey = JSON.stringify(queryKey);

  React.useEffect(() => {
    return subscribeQueryInvalidation(() => {
      void queryClient.invalidateQueries({ queryKey });
    });
  }, [queryClient, serializedKey]);

  return useTanstackQuery<T[]>({
    queryKey,
    enabled,
    queryFn: () => db.getAll<T>(query, parameters),
  });
}

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
