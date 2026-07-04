const WEBSOCKET_HINT = [
  'PowerSync Dashboard → Client Auth:',
  '• Enable "Supabase Auth"',
  '• Leave JWT Secret empty if Supabase uses new ES256 signing keys',
  '• Or set JWKS to https://YOURPROJECT.supabase.co/auth/v1/.well-known/jwks.json and audience "authenticated"',
  '• Click Save & Deploy, then sign out and sign back in here',
].join('\n');

/** Append setup hints for known Supabase / PowerSync errors. */
export function formatSyncSchemaError(message: string): string {
  if (
    message.includes('Failed to create websocket connection') ||
    message.includes('WebSocket connection closed while opening')
  ) {
    return `${message}\n\n${WEBSOCKET_HINT}`;
  }
  if (message.includes('PSYNC_S2101') || message.includes('Could not find an appropriate key')) {
    return `${message}\n\nSupabase JWT keys may not match PowerSync auth. In PowerSync Dashboard → Client Auth, enable Supabase Auth and clear the legacy JWT secret, then sign out and back in.`;
  }
  if (message.includes('PSYNC_S2105') || message.includes("required claim 'aud'")) {
    return `${message}\n\nAdd JWT audience "authenticated" in PowerSync Dashboard → Client Auth.`;
  }
  if (message.includes('Not signed in')) {
    return `${message} Sign in again to restore cloud sync.`;
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
  return message;
}
