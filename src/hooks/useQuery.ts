/**
 * Reactive query hooks: PowerSync SQLite watch for instant local updates.
 * Watches re-run automatically when dependent tables change (local writes or Realtime).
 */
import * as React from 'react';
import type { QueryResult } from '@powersync/common';
import { db } from '../system/db';
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

function rowsFromResult<T>(result: QueryResult): T[] {
  return (result.rows?._array ?? []) as T[];
}

export function useQuery<T>(opts: SqlQueryOptions) {
  const { query, parameters = [], enabled = true } = opts;
  const [data, setData] = React.useState<T[] | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(enabled);
  const serializedParams = JSON.stringify(parameters);

  React.useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const abort = new AbortController();
    setIsLoading(true);

    db.watch(
      query,
      parameters,
      {
        onResult: (result) => {
          if (abort.signal.aborted) return;
          setData(rowsFromResult<T>(result));
          setIsLoading(false);
        },
        onError: () => {
          if (abort.signal.aborted) return;
          setIsLoading(false);
        },
      },
      { signal: abort.signal, throttleMs: 0 },
    );

    return () => abort.abort();
  }, [query, serializedParams, enabled]);

  return { data, isLoading };
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
