import { CrudEntry, type AbstractPowerSyncDatabase } from '@powersync/web';

export type UploadQueueItem = {
  op: CrudEntry['op'];
  table: string;
  id: string;
};

/** Preview pending upload ops without removing them from the queue. */
export async function peekUploadQueue(
  db: AbstractPowerSyncDatabase,
  limit = 15,
): Promise<UploadQueueItem[]> {
  const batch = await db.getCrudBatch(limit);
  if (!batch) return [];
  return batch.crud.map((e) => ({ op: e.op, table: e.table, id: e.id }));
}

/** Discard all pending uploads. Local data is kept; changes will not reach the cloud. */
export async function clearUploadQueue(db: AbstractPowerSyncDatabase): Promise<number> {
  let cleared = 0;
  for (;;) {
    const tx = await db.getNextCrudTransaction();
    if (!tx) break;
    cleared += tx.crud.length;
    await tx.complete();
  }
  return cleared;
}

export function formatQueueSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
