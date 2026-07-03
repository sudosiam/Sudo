import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { SEED_ACCOUNTS } from './accounts';

/** Idempotently seed the Chart of Accounts and default settings. */
export async function ensureSeeded(db: AbstractPowerSyncDatabase) {
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    for (const a of SEED_ACCOUNTS) {
      await tx.execute(
        `INSERT OR IGNORE INTO accounts (id, code, name, type, subtype, is_system, archived, include_in_liquid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`,
        [a.id, a.code, a.name, a.type, a.subtype, a.is_system, now],
      );
    }
  });
}
