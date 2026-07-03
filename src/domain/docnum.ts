import type { AbstractPowerSyncDatabase } from '@powersync/web';

type Tx = Parameters<Parameters<AbstractPowerSyncDatabase['writeTransaction']>[0]>[0];

/** Preview the next number without consuming it (for new-document forms). */
export async function peekNextDocNumber(
  db: AbstractPowerSyncDatabase,
  table: 'sales' | 'purchases',
  prefix: string,
): Promise<{ seq: number; docNo: string }> {
  const row = await db.getOptional<{ max_seq: number | null }>(
    `SELECT MAX(seq) AS max_seq FROM ${table}`,
  );
  const seq = (row?.max_seq ?? 0) + 1;
  return { seq, docNo: `${prefix}-${String(seq).padStart(3, '0')}` };
}

/** Next sequential document number, e.g. ("sales","INV") -> { seq: 12, docNo: "INV-012" } */
export async function nextDocNumber(
  tx: Tx,
  table: 'sales' | 'purchases',
  prefix: string,
): Promise<{ seq: number; docNo: string }> {
  const row = await tx.getOptional<{ max_seq: number | null }>(
    `SELECT MAX(seq) AS max_seq FROM ${table}`,
  );
  const seq = (row?.max_seq ?? 0) + 1;
  return { seq, docNo: `${prefix}-${String(seq).padStart(3, '0')}` };
}
