/** Decode a JWT payload without verifying the signature (client-side diagnostics only). */
export function decodeJwtPart(part: string): Record<string, unknown> | null {
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function decodeAccessToken(token: string): {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
} {
  const [h, p] = token.split('.');
  if (!h || !p) return { header: null, payload: null };
  return { header: decodeJwtPart(h), payload: decodeJwtPart(p) };
}

export type SyncTokenDiagnostics = {
  ok: boolean;
  summary: string;
  details: string[];
};

export function diagnoseAccessToken(token: string | null | undefined): SyncTokenDiagnostics {
  if (!token) {
    return {
      ok: false,
      summary: 'Not signed in',
      details: ['Sign in so PowerSync can use your Supabase access token.'],
    };
  }

  const { header, payload } = decodeAccessToken(token);
  if (!payload) {
    return {
      ok: false,
      summary: 'Invalid token format',
      details: ['Could not read the session JWT. Sign out and sign back in.'],
    };
  }

  const details: string[] = [];
  const alg = header?.alg;
  if (alg) details.push(`JWT algorithm: ${String(alg)}`);

  const role = payload.role;
  if (role !== 'authenticated') {
    details.push(`JWT role is "${String(role)}" — must be "authenticated" (you may be using the anon key).`);
  }

  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud.map(String) : aud != null ? [String(aud)] : [];
  if (!audiences.includes('authenticated')) {
    details.push(
      `JWT audience is ${JSON.stringify(aud)} — PowerSync expects "authenticated" in Client Auth.`,
    );
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp != null) {
    const left = exp - Math.floor(Date.now() / 1000);
    details.push(left > 0 ? `Token expires in ${Math.round(left / 60)} min` : 'Token is expired — sign in again');
  }

  const sub = payload.sub;
  if (sub) details.push(`User id: ${String(sub).slice(0, 8)}…`);

  const ok =
    role === 'authenticated' &&
    audiences.includes('authenticated') &&
    (exp == null || exp > Math.floor(Date.now() / 1000));

  return {
    ok,
    summary: ok ? 'Session token looks valid' : 'Session token may block sync',
    details,
  };
}

export function supabaseJwksUrl(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    return `${new URL(supabaseUrl).origin}/auth/v1/.well-known/jwks.json`;
  } catch {
    return null;
  }
}
