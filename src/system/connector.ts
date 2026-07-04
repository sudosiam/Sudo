import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  UpdateType,
  type PowerSyncBackendConnector,
} from '@powersync/web';
import { supabase, powersyncUrl } from './supabase';

/**
 * Postgres / PostgREST error codes that will never resolve by retrying — the local
 * op is discarded so the upload queue doesn't wedge.
 */
const FATAL_RESPONSE_CODES = [
  /^22\d{3}$/, // data exception (constraint, invalid text, etc.)
  /^23\d{3}$/, // integrity constraint
  /^42\d{3}$/, // syntax / undefined column / permission (42501, 42703, …)
  /^PGRST/i, // PostgREST schema/API errors (e.g. PGRST204 missing column)
];

function isFatalUploadError(ex: unknown): boolean {
  const err = ex as { code?: string; message?: string };
  const code = err?.code ?? '';
  const message = err?.message ?? '';
  if (FATAL_RESPONSE_CODES.some((re) => re.test(code))) return true;
  if (message.includes('schema cache')) return true;
  return false;
}

/** Refresh the Supabase session only when the access token is about to expire. */
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  let session = data.session;
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
  if (secondsLeft < 60) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    session = refreshed.data.session ?? session;
  }

  return session?.access_token ?? null;
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    if (!supabase || !powersyncUrl) return null;

    const token = await getAccessToken();
    if (!token) return null;

    return {
      endpoint: powersyncUrl.replace(/\/$/, ''),
      token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // Throw so PowerSync retries instead of leaving the upload queue wedged.
      throw new Error('Not signed in');
    }

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
      if (isFatalUploadError(ex)) {
        console.error('Discarding non-retryable upload operation', lastOp, ex);
        await transaction.complete();
      } else {
        // Retryable (network etc.) — PowerSync will retry the queue.
        throw ex;
      }
    }
  }
}
