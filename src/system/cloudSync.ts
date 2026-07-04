import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  CrudEntry,
  UpdateType,
  type AbstractPowerSyncDatabase,
} from '@powersync/web';
import { db, withoutMutationHooks } from './db';
import { supabase, cloudConfigured } from './supabase';
import { SYNCED_TABLES } from './schema';
import { recordDiscardedUpload } from '../lib/syncFailures';
import { SEED_ACCOUNT_IDS } from '../domain/accounts';
import { invalidateQueries } from './queryBus';
import { registerCloudPushHandlers } from './mutationHooks';
import { INSERT_ORDER } from '../domain/backup';

const FATAL_RESPONSE_CODES = [
  /^22\d{3}$/,
  /^23\d{3}$/,
  /^42\d{3}$/,
  /^PGRST/i,
];

export type CloudSyncStatus = {
  connected: boolean;
  connecting: boolean;
  syncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  pendingUploads: number;
};

type StatusListener = (status: CloudSyncStatus) => void;

let channel: RealtimeChannel | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
let pushAgainWhenDone = false;
let pullInFlight = false;
let activeUserId: string | null = null;

const statusListeners = new Set<StatusListener>();

let status: CloudSyncStatus = {
  connected: false,
  connecting: false,
  syncing: false,
  lastSyncedAt: null,
  error: null,
  pendingUploads: 0,
};

function emitStatus(patch: Partial<CloudSyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l(status));
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return status;
}

export function subscribeCloudSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

function shouldSkipAccountUpload(op: CrudEntry): boolean {
  if (op.table !== 'accounts') return false;
  if (SEED_ACCOUNT_IDS.has(op.id)) return true;
  const v = op.opData?.is_system;
  return v === 1 || v === '1' || v === true || Number(v) === 1;
}

function accountPutPayload(op: CrudEntry, ownerId: string) {
  const data = op.opData ?? {};
  return {
    ...data,
    id: op.id,
    owner_id: ownerId,
    include_in_liquid: data.include_in_liquid ?? 1,
  };
}

function isFatalUploadError(ex: unknown): boolean {
  const err = ex as { code?: string; message?: string };
  const code = err?.code ?? '';
  const message = err?.message ?? '';
  if (FATAL_RESPONSE_CODES.some((re) => re.test(code))) return true;
  if (message.includes('schema cache')) return true;
  return false;
}

async function countPendingUploads(database: AbstractPowerSyncDatabase): Promise<number> {
  const row = await database.getOptional<{ n: number }>(`SELECT COUNT(*) AS n FROM ps_crud`);
  return row?.n ?? 0;
}

/** Discard PowerSync CRUD entries created by applying remote rows (avoids re-upload loops). */
async function clearCrudQueue() {
  try {
    await db.execute(`DELETE FROM ps_crud`);
  } catch {
    /* ps_crud may not exist before first init */
  }
}

function rowToUpsertSql(table: string, row: Record<string, unknown>) {
  const { owner_id: _owner, ...rest } = row;
  const cols = Object.keys(rest);
  if (cols.length === 0) return null;
  const placeholders = cols.map(() => '?').join(', ');
  return {
    sql: `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    params: cols.map((c) => rest[c]),
  };
}

function putPayload(op: CrudEntry, ownerId: string) {
  if (op.table === 'accounts') return accountPutPayload(op, ownerId);
  return { ...(op.opData ?? {}), id: op.id, owner_id: ownerId };
}

async function applyRemoteInsert(table: string, row: Record<string, unknown>) {
  const stmt = rowToUpsertSql(table, row);
  if (!stmt) return;
  await withoutMutationHooks(() => db.execute(stmt.sql, stmt.params));
}

async function applyRemotePatch(table: string, row: Record<string, unknown>) {
  const { owner_id: _owner, id, ...rest } = row;
  if (typeof id !== 'string') return;
  const cols = Object.keys(rest);
  if (cols.length === 0) return;
  const sets = cols.map((c) => `${c} = ?`).join(', ');
  await withoutMutationHooks(() =>
    db.execute(`UPDATE ${table} SET ${sets} WHERE id = ?`, [...cols.map((c) => rest[c]), id]),
  );
}

async function applyRemoteDelete(table: string, id: string) {
  await withoutMutationHooks(() => db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]));
}

/** Pull all synced tables from Supabase into local SQLite. */
export async function pullFromCloud(userId: string) {
  if (!supabase || pullInFlight) return;
  pullInFlight = true;
  emitStatus({ syncing: true, error: null });
  try {
    const tables = INSERT_ORDER.filter(
      (t) => t !== 'drafts' && SYNCED_TABLES.includes(t as (typeof SYNCED_TABLES)[number]),
    );

    const results = await Promise.all(
      tables.map(async (table) => {
        const { data, error } = await supabase!.from(table).select('*').eq('owner_id', userId);
        if (error) throw error;
        return { table, rows: data ?? [] };
      }),
    );

    for (const { table, rows } of results) {
      await withoutMutationHooks(() =>
        db.writeTransaction(async (tx) => {
          await tx.execute(`DELETE FROM ${table}`);
          for (const row of rows) {
            const stmt = rowToUpsertSql(table, row as Record<string, unknown>);
            if (stmt) await tx.execute(stmt.sql, stmt.params);
          }
        }),
      );
    }
    await clearCrudQueue();
    emitStatus({ lastSyncedAt: new Date(), error: null });
    invalidateQueries();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Cloud pull failed';
    console.error('pullFromCloud failed', e);
    emitStatus({ error: message });
    throw e;
  } finally {
    pullInFlight = false;
    emitStatus({ syncing: pushInFlight, pendingUploads: await countPendingUploads(db) });
  }
}

/** Upload one CRUD batch — batch PUTs per table to cut round-trips on multi-row writes. */
async function uploadCrudBatch(crud: CrudEntry[], ownerId: string) {
  if (!supabase) return;
  let i = 0;
  while (i < crud.length) {
    const op = crud[i]!;
    if (op.op === UpdateType.PUT) {
      if (shouldSkipAccountUpload(op)) {
        i++;
        continue;
      }
      const table = op.table;
      const batch: CrudEntry[] = [];
      while (i < crud.length) {
        const next = crud[i]!;
        if (next.op !== UpdateType.PUT || next.table !== table || shouldSkipAccountUpload(next)) break;
        batch.push(next);
        i++;
      }
      const rows = batch.map((entry) => putPayload(entry, ownerId));
      const result = await supabase.from(table).upsert(rows);
      if (result.error) {
        (result.error as Error & { code?: string }).message ||= 'Supabase upload error';
        throw result.error;
      }
      continue;
    }

    const table = supabase.from(op.table);
    let result: { error: { message?: string; code?: string } | null } | null = null;
    switch (op.op) {
      case UpdateType.PATCH:
        result = await table.update(op.opData ?? {}).eq('id', op.id).eq('owner_id', ownerId);
        break;
      case UpdateType.DELETE:
        result = await table.delete().eq('id', op.id).eq('owner_id', ownerId);
        break;
    }
    if (result?.error) {
      (result.error as Error & { code?: string }).message ||= 'Supabase upload error';
      throw result.error;
    }
    i++;
  }
}

/** Drain the local CRUD queue to Supabase. */
export async function pushPendingChanges() {
  if (!supabase) return;
  if (pushInFlight) {
    pushAgainWhenDone = true;
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const ownerId = session.user.id;
  pushInFlight = true;
  emitStatus({ syncing: true, error: null });

  const maxOpsPerCall = 200;
  let uploadedOps = 0;
  let drainedPartially = false;

  try {
    for (;;) {
      const transaction = await db.getNextCrudTransaction();
      if (!transaction) break;

      let lastOp: CrudEntry | null = null;
      try {
        lastOp = transaction.crud[transaction.crud.length - 1] ?? null;
        await uploadCrudBatch(transaction.crud, ownerId);
        await transaction.complete();
        uploadedOps += transaction.crud.length;
        if (uploadedOps >= maxOpsPerCall) {
          drainedPartially = true;
          break;
        }
      } catch (ex) {
        if (isFatalUploadError(ex)) {
          console.error('Discarding non-retryable upload operation', lastOp, ex);
          const err = ex as { message?: string };
          recordDiscardedUpload({
            id: lastOp?.id ?? `unknown-${Date.now()}`,
            table: lastOp?.table ?? 'unknown',
            op: lastOp ? String(lastOp.op) : '?',
            message: err?.message ?? 'Upload rejected by server',
          });
          await transaction.complete();
          uploadedOps += transaction.crud.length;
          if (uploadedOps >= maxOpsPerCall) break;
        } else {
          const message = ex instanceof Error ? ex.message : 'Upload failed';
          emitStatus({ error: message });
          throw ex;
        }
      }
    }
    emitStatus({ lastSyncedAt: new Date(), error: null });
    invalidateQueries();
  } finally {
    pushInFlight = false;
    const pending = await countPendingUploads(db);
    emitStatus({ syncing: pullInFlight, pendingUploads: pending });
    const again = pushAgainWhenDone;
    pushAgainWhenDone = false;
    if (pending > 0 && (again || drainedPartially)) {
      queueMicrotask(() => {
        pushPendingChanges().catch((e) => console.error('pushPendingChanges chained failed', e));
      });
    }
  }
}

export function schedulePush() {
  if (!cloudConfigured || !navigator.onLine) return;
  if (pushTimer) clearTimeout(pushTimer);
  // Brief coalesce for rapid keystrokes; still far faster than the old 500ms debounce.
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushPendingChanges().catch((e) => console.error('pushPendingChanges failed', e));
  }, 16);
}

async function handleRealtimePayload(
  table: string,
  payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> },
) {
  try {
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (typeof id === 'string') await applyRemoteDelete(table, id);
    } else if (payload.eventType === 'UPDATE') {
      if (payload.new && Object.keys(payload.new).length > 0) {
        await applyRemotePatch(table, payload.new);
        await withoutMutationHooks(() =>
          db.execute(`DELETE FROM ps_crud WHERE data LIKE ?`, [`%"id":"${payload.new.id}"%`]),
        );
      }
    } else if (payload.new && Object.keys(payload.new).length > 0) {
      await applyRemoteInsert(table, payload.new);
      await withoutMutationHooks(() =>
        db.execute(`DELETE FROM ps_crud WHERE data LIKE ?`, [`%"id":"${payload.new.id}"%`]),
      );
    }
    invalidateQueries();
    emitStatus({ lastSyncedAt: new Date() });
  } catch (e) {
    console.error('Realtime apply failed', table, e);
  }
}

function removeRealtimeChannel() {
  if (channel && supabase) {
    void supabase.removeChannel(channel);
  }
  channel = null;
}

function stopRealtime() {
  removeRealtimeChannel();
  emitStatus({ connected: false, connecting: false });
}

function startRealtime(userId: string) {
  if (!supabase) return;
  removeRealtimeChannel();

  emitStatus({ connecting: true, connected: false });

  const ch = supabase.channel(`sudo-realtime-${userId}`);
  for (const table of SYNCED_TABLES) {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `owner_id=eq.${userId}` },
      (payload) => {
        void handleRealtimePayload(table, payload as typeof payload & { new: Record<string, unknown>; old: Record<string, unknown> });
      },
    );
  }

  ch.subscribe((state) => {
    const connected = state === 'SUBSCRIBED';
    const failed = state === 'CLOSED' || state === 'CHANNEL_ERROR' || state === 'TIMED_OUT';
    emitStatus({
      connected,
      connecting: !connected && !failed,
      error: failed ? status.error ?? 'Realtime connection failed' : connected ? null : status.error,
    });
    if (connected && navigator.onLine) {
      void pushPendingChanges().catch((e) => console.error('push on realtime connect failed', e));
    }
  });

  channel = ch;
}

/** Full cloud sync lifecycle: Realtime first, then push/pull in background. */
export async function startCloudSync(userId: string) {
  if (!cloudConfigured || !supabase) return;
  activeUserId = userId;
  emitStatus({ error: null });

  // Show "Live" as soon as Realtime connects — don't block on full data pull.
  startRealtime(userId);

  void (async () => {
    try {
      await pushPendingChanges();
      await pullFromCloud(userId);
    } catch (e) {
      console.error('startCloudSync background sync failed', e);
    }
  })();
}

export function stopCloudSync() {
  activeUserId = null;
  stopRealtime();
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  emitStatus({
    connected: false,
    connecting: false,
    syncing: false,
    pendingUploads: 0,
    error: null,
  });
}

/** Reconnect Realtime + push pending changes (tab wake / online). */
export async function reconnectCloudSync() {
  if (!activeUserId || !cloudConfigured || !navigator.onLine) return;
  try {
    await pushPendingChanges();
    startRealtime(activeUserId);
  } catch (e) {
    console.error('reconnectCloudSync failed', e);
  }
}

export async function refreshPendingCount() {
  const pending = await countPendingUploads(db);
  emitStatus({ pendingUploads: pending });
  return pending;
}

/** Discard all pending local uploads (ps_crud queue). */
export async function clearPendingUploads() {
  await clearCrudQueue();
  await refreshPendingCount();
}

registerCloudPushHandlers(
  () => schedulePush(),
  () => refreshPendingCount(),
);
