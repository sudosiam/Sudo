import type { Session } from '@supabase/supabase-js';
import type { PowerSyncConnectionOptions } from '@powersync/common';
import { db } from './db';
import { SupabaseConnector } from './connector';

/** Shared connector instance — PowerSync reuses it for fetchCredentials / uploadData. */
export const syncConnector = new SupabaseConnector();

/** Faster reconnect + upload cadence so multi-device changes propagate quickly. */
export const SYNC_CONNECT_OPTIONS: PowerSyncConnectionOptions = {
  retryDelayMs: 2000,
  crudUploadThrottleMs: 500,
};

export function connectSync() {
  const { connected, connecting } = db.currentStatus;
  if (connected || connecting) return Promise.resolve();
  return db.connect(syncConnector, SYNC_CONNECT_OPTIONS);
}

/** Force a new connection (e.g. after fixing PowerSync dashboard auth). */
export function forceReconnectSync() {
  return db.connect(syncConnector, SYNC_CONNECT_OPTIONS);
}

export function disconnectSync() {
  return db.disconnect();
}

/** Reconnect when the tab wakes or network returns, but only if sync is down. */
export function reconnectSyncIfNeeded(session: Session | null) {
  if (!session || !navigator.onLine) return;
  if (document.visibilityState !== 'visible') return;

  const { connected, connecting } = db.currentStatus;
  if (connected || connecting) return;

  connectSync().catch((e) => {
    console.error('PowerSync reconnect failed', e);
  });
}
