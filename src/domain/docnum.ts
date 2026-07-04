import type { AbstractPowerSyncDatabase } from '@powersync/web';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

const docNoColumn: Record<'sales' | 'purchases', 'invoice_no' | 'bill_no'> = {
  sales: 'invoice_no',
  purchases: 'bill_no',
};

/** Preview the next number without consuming it (for new-document forms). */
export async function peekNextDocNumber(
  db: AbstractPowerSyncDatabase,
  table: 'sales' | 'purchases',
  prefix: string,
): Promise<{ seq: number; docNo: string }> {
  const col = docNoColumn[table];
  const row = await db.getOptional<{ max_seq: number | null }>(
    `SELECT MAX(seq) AS max_seq FROM ${table}`,
  );
  let seq = (row?.max_seq ?? 0) + 1;
  let docNo = `${prefix}-${String(seq).padStart(3, '0')}`;
  for (let guard = 0; guard < 1000; guard++) {
    const clash = await db.getOptional<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${col} = ? LIMIT 1`,
      [docNo],
    );
    if (!clash) break;
    seq += 1;
    docNo = `${prefix}-${String(seq).padStart(3, '0')}`;
  }
  return { seq, docNo };
}

/**
 * Next sequential document number, e.g. ("sales","INV") -> { seq: 12, docNo: "INV-012" }.
 *
 * Re-rolls past any number already present locally so a same-device retry (or a number
 * that just synced down from another device) never collides. This does not eliminate
 * cross-device collisions the instant two offline devices save at once, but it removes
 * the far more common case where a stale `seq` was read before a background sync applied.
 */
export async function nextDocNumber(
  tx: Tx,
  table: 'sales' | 'purchases',
  prefix: string,
): Promise<{ seq: number; docNo: string }> {
  const col = docNoColumn[table];
  const row = await tx.getOptional<{ max_seq: number | null }>(
    `SELECT MAX(seq) AS max_seq FROM ${table}`,
  );
  let seq = (row?.max_seq ?? 0) + 1;
  let docNo = `${prefix}-${String(seq).padStart(3, '0')}`;
  // Defensive loop — should normally run 0 times.
  for (let guard = 0; guard < 1000; guard++) {
    const clash = await tx.getOptional<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${col} = ? LIMIT 1`,
      [docNo],
    );
    if (!clash) break;
    seq += 1;
    docNo = `${prefix}-${String(seq).padStart(3, '0')}`;
  }
  return { seq, docNo };
}

/** Throws if a document with this number already exists locally (manual override guard). */
export async function assertDocNumberAvailable(
  tx: Tx,
  table: 'sales' | 'purchases',
  docNo: string,
  excludeId?: string,
): Promise<void> {
  const col = docNoColumn[table];
  const row = await tx.getOptional<{ id: string }>(
    excludeId
      ? `SELECT id FROM ${table} WHERE ${col} = ? AND id != ? LIMIT 1`
      : `SELECT id FROM ${table} WHERE ${col} = ? LIMIT 1`,
    excludeId ? [docNo, excludeId] : [docNo],
  );
  if (row) {
    throw new Error(`Document number "${docNo}" is already in use — choose a different number.`);
  }
}
