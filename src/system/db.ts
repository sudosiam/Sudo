import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';
import { cloudConfigured } from './supabase';
import { onLocalMutation } from './mutationHooks';
import { invalidateQueries } from './queryBus';

/**
 * Local SQLite database (wa-sqlite / OPFS). Always available for instant reads and writes.
 * When cloud is configured, changes upload to Supabase and Realtime keeps devices in sync.
 */
const inner = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'sudo-finance.db' },
});

let suppressMutationHooks = false;

/** Run writes without triggering cloud upload (used when applying remote Realtime rows). */
export function withoutMutationHooks<T>(fn: () => Promise<T>): Promise<T> {
  suppressMutationHooks = true;
  return fn().finally(() => {
    suppressMutationHooks = false;
  });
}

async function wrapMutation<T>(fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  if (suppressMutationHooks) return result;
  if (cloudConfigured) onLocalMutation();
  else invalidateQueries();
  return result;
}

const origExecute = inner.execute.bind(inner);
const origWriteTransaction = inner.writeTransaction.bind(inner);

export const db = Object.assign(inner, {
  execute(sql: string, parameters?: unknown[]) {
    return wrapMutation(() => origExecute(sql, parameters));
  },
  writeTransaction(
    callback: Parameters<typeof inner.writeTransaction>[0],
    lockTimeout?: number,
  ) {
    return wrapMutation(() => origWriteTransaction(callback, lockTimeout));
  },
});
