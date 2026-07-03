import type { AbstractPowerSyncDatabase } from '@powersync/web';
import { uuid } from '../lib/utils';

/** Auto-save drafts (local-only table, never synced). One draft per kind. */

export async function saveDraft(db: AbstractPowerSyncDatabase, kind: 'sale' | 'purchase', data: unknown) {
  const existing = await db.getOptional<{ id: string }>(
    `SELECT id FROM drafts WHERE kind = ? LIMIT 1`,
    [kind],
  );
  const json = JSON.stringify(data);
  const now = new Date().toISOString();
  if (existing) {
    await db.execute(`UPDATE drafts SET data = ?, updated_at = ? WHERE id = ?`, [json, now, existing.id]);
  } else {
    await db.execute(`INSERT INTO drafts (id, kind, data, updated_at) VALUES (?, ?, ?, ?)`, [
      uuid(),
      kind,
      json,
      now,
    ]);
  }
}

export async function loadDraft<T>(
  db: AbstractPowerSyncDatabase,
  kind: 'sale' | 'purchase',
): Promise<T | null> {
  const row = await db.getOptional<{ data: string }>(
    `SELECT data FROM drafts WHERE kind = ? LIMIT 1`,
    [kind],
  );
  if (!row) return null;
  try {
    return JSON.parse(row.data) as T;
  } catch {
    return null;
  }
}

export async function clearDraft(db: AbstractPowerSyncDatabase, kind: 'sale' | 'purchase') {
  await db.execute(`DELETE FROM drafts WHERE kind = ?`, [kind]);
}
