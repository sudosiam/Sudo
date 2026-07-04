import { supabaseJwksUrl } from './syncDiagnostics';

function websocketHint(): string {
  const jwks = supabaseJwksUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const jwksLine = jwks
    ? `• JWKS URI (URL only — do NOT paste JSON keys):\n  ${jwks}`
    : '• JWKS URI: https://YOURPROJECT.supabase.co/auth/v1/.well-known/jwks.json';

  return [
    'PowerSync Dashboard → Client Auth (then Save & Deploy):',
    '',
    'Option A — auto (try first):',
    '• Enable "Supabase Auth"',
    '• Clear / leave empty: JWT Secret AND any JWKS JSON text fields',
    '• Database connection must use your Supabase Postgres URI (for auto-detect)',
    '',
    'Option B — manual (if you saw "Missing property x" before):',
    '• Disable "Supabase Auth" checkbox',
    jwksLine,
    '• Audience: authenticated',
    '',
    'Then in this app: sign out → sign back in → Settings → reconnect (↻).',
  ].join('\n');
}

/** Append setup hints for known Supabase / PowerSync errors. */
export function formatSyncSchemaError(message: string): string {
  if (
    message.includes('Failed to create websocket connection') ||
    message.includes('WebSocket connection closed while opening')
  ) {
    return `${message}\n\n${websocketHint()}`;
  }
  if (message.includes('PSYNC_S2101') || message.includes('Could not find an appropriate key')) {
    return `${message}\n\nSupabase JWT keys may not match PowerSync auth. Enable Supabase Auth with JWT secret empty (ES256), or set the JWKS URL above manually. Then sign out and back in.`;
  }
  if (message.includes('PSYNC_S2105') || message.includes("required claim 'aud'")) {
    return `${message}\n\nAdd JWT audience "authenticated" in PowerSync Dashboard → Client Auth.`;
  }
  if (message.includes('Not signed in') || message.includes('Session token expired')) {
    return `${message} Sign in again to restore cloud sync.`;
  }
  if (message.includes('JWT audience') || message.includes('JWT role')) {
    return `${message}\n\n${websocketHint()}`;
  }
  if (message.includes('opening_qty') && message.includes('schema cache')) {
    return `${message} Fix: run supabase/migrations/20260704_v0_2_2_inventory_opening.sql in Supabase SQL Editor, then reconnect PowerSync.`;
  }
  if (message.includes('include_in_liquid') && message.includes('schema cache')) {
    return `${message} Fix: run supabase/migrations/20260704_v0_2_0.sql in Supabase SQL Editor, then reconnect PowerSync.`;
  }
  if (message.includes('recurring_expenses') && message.includes('schema cache')) {
    return `${message} Fix: run supabase/migrations/20260704_v0_2_0.sql in Supabase SQL Editor, then redeploy sync rules.`;
  }
  if (message.includes('sales_owner_invoice_no_uidx') || message.includes('purchases_owner_bill_no_uidx')) {
    return `${message}\n\nAnother device already used this document number. Reopen the document and save again to get a fresh number.`;
  }
  if (
    message.includes('row-level security policy') &&
    (message.includes('accounts') || message.includes('"accounts"'))
  ) {
    return `${message}\n\nWhy: built-in accounts (Cash, Inventory, Rent, etc.) use fixed IDs like acc-cash. Your Supabase project already has those rows owned by another login — Postgres blocks the upload. The app now skips syncing those rows; only custom bank/expense accounts sync. Clear sync errors in Settings, hard-refresh the app, and re-save any custom accounts you added. Use one login email per Supabase project.`;
  }
  return message;
}
