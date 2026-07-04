import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  UpdateType,
  type PowerSyncBackendConnector,
} from '@powersync/web';
import { supabase, powersyncUrl } from './supabase';
import { decodeAccessToken } from '../lib/syncDiagnostics';
import { recordDiscardedUpload } from '../lib/syncFailures';
import { SEED_ACCOUNT_IDS } from '../domain/accounts';

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

/** Seeded chart-of-accounts rows use global IDs (acc-cash, …) — local-only for sync. */
function shouldSkipAccountUpload(op: CrudEntry): boolean {
  if (op.table !== 'accounts') return false;
  // Deterministic seed IDs — never upload (global PK collides across auth users).
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

function assertSyncToken(token: string): void {
  const { payload } = decodeAccessToken(token);
  if (!payload) throw new Error('Invalid session token — sign out and sign back in.');

  if (payload.role !== 'authenticated') {
    throw new Error(
      'PowerSync requires a signed-in user (JWT role must be "authenticated", not anon).',
    );
  }

  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud.map(String) : aud != null ? [String(aud)] : [];
  if (!audiences.includes('authenticated')) {
    throw new Error(
      `JWT audience ${JSON.stringify(aud)} is not accepted — set audience "authenticated" in PowerSync Client Auth.`,
    );
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp != null && exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Session token expired — sign out and sign back in.');
  }
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    if (!supabase || !powersyncUrl) return null;

    const token = await getAccessToken();
    if (!token) return null;

    assertSyncToken(token);

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
    const maxOpsPerCall = 200;
    let uploadedOps = 0;

    for (;;) {
      const transaction = await database.getNextCrudTransaction();
      if (!transaction) return;

      let lastOp: CrudEntry | null = null;
      try {
        for (const op of transaction.crud) {
          lastOp = op;
          const table = supabase.from(op.table);
          let result: { error: { message?: string; code?: string } | null } | null = null;
          switch (op.op) {
            case UpdateType.PUT:
              // System accounts are seeded locally per device/user; uploading them
              // collides with another user's row (global PK) and fails RLS.
              if (shouldSkipAccountUpload(op)) continue;
              if (op.table === 'accounts') {
                result = await supabase
                  .from('accounts')
                  .upsert(accountPutPayload(op, ownerId));
              } else {
                result = await table.upsert({
                  ...(op.opData ?? {}),
                  id: op.id,
                  owner_id: ownerId,
                });
              }
              break;
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
        }
        await transaction.complete();
        uploadedOps += transaction.crud.length;
        if (uploadedOps >= maxOpsPerCall) return;
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
          if (uploadedOps >= maxOpsPerCall) return;
        } else {
          // Retryable (network etc.) — PowerSync will retry the queue.
          throw ex;
        }
      }
    }
  }
}
