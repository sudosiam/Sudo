import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  UpdateType,
  type PowerSyncBackendConnector,
} from '@powersync/web';
import { supabase, powersyncUrl } from './supabase';

/**
 * Postgres error codes that will never resolve by retrying — the local
 * op is discarded so the upload queue doesn't wedge.
 */
const FATAL_RESPONSE_CODES = [/^22\d{3}$/, /^23\d{3}$/, /^42501$/];

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    if (!supabase || !powersyncUrl) return null;

    // Return a fresh JWT so the PowerSync WebSocket stays authenticated.
    const refreshed = await supabase.auth.refreshSession();
    const session =
      refreshed.data.session ?? (await supabase.auth.getSession()).data.session;
    if (!session) return null;

    return {
      endpoint: powersyncUrl.replace(/\/$/, ''),
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const ownerId = session.user.id;
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let lastOp: CrudEntry | null = null;
    try {
      for (const op of transaction.crud) {
        lastOp = op;
        const table = supabase.from(op.table);
        let result;
        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({
              ...(op.opData ?? {}),
              id: op.id,
              owner_id: ownerId,
            });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData ?? {}).eq('id', op.id).eq('owner_id', ownerId);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id).eq('owner_id', ownerId);
            break;
        }
        if (result.error) {
          (result.error as Error & { code?: string }).message ||= 'Supabase upload error';
          throw result.error;
        }
      }
      await transaction.complete();
    } catch (ex) {
      const code = (ex as { code?: string })?.code;
      if (typeof code === 'string' && FATAL_RESPONSE_CODES.some((re) => re.test(code))) {
        console.error('Discarding non-retryable operation', lastOp, ex);
        await transaction.complete();
      } else {
        // Retryable (network etc.) — PowerSync will retry the queue.
        throw ex;
      }
    }
  }
}
