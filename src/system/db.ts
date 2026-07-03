import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';

/**
 * The local SQLite database. Always available (offline-first); connects to
 * the PowerSync service only when cloud credentials are configured and the
 * user is signed in (see SystemProvider).
 */
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'sudo-finance.db' },
});
