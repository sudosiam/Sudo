import * as React from 'react';
import { PowerSyncContext } from '@powersync/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { db } from './db';
import { supabase, cloudConfigured } from './supabase';
import { ensureSeeded } from '../domain/seed';
import { connectSync, reconnectSyncIfNeeded } from './syncLifecycle';
import { clearLocalUserData } from '../lib/localWipe';
import { LoginScreen } from './LoginScreen';
import { PageSpinner } from '../components/ui/misc';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is local — no need for aggressive refetching; watch queries
      // invalidate automatically when underlying tables change.
      staleTime: 60_000,
      retry: 1,
    },
  },
});

interface AuthContextValue {
  session: Session | null;
  signOut: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextValue>({
  session: null,
  signOut: async () => {},
});

export const useAuth = () => React.useContext(AuthContext);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [authLoading, setAuthLoading] = React.useState(cloudConfigured);
  const sessionRef = React.useRef<Session | null>(null);
  const prevUserIdRef = React.useRef<string | null>(null);

  // Initialize local DB + seed chart of accounts
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await db.init();
        await ensureSeeded(db);
        if (!cancelled) setReady(true);
      } catch (e) {
        console.error('Database init failed', e);
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        if (
          message.includes('insecure context') ||
          (typeof window !== 'undefined' && !window.isSecureContext)
        ) {
          setInitError(
            'This app needs a secure connection. On mobile, open the HTTPS link (not HTTP) and accept the certificate warning.',
          );
        } else {
          setInitError(message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auth state + PowerSync connection lifecycle
  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch((e) => {
        console.error('Auth session check failed', e);
        setAuthLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      sessionRef.current = s;
    });
    return () => subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Connect / wipe when the signed-in user changes (not on every token refresh).
  const userId = session?.user?.id ?? null;
  React.useEffect(() => {
    if (!cloudConfigured || !ready) return;

    const prev = prevUserIdRef.current;
    if (prev === userId) return;

    let cancelled = false;
    (async () => {
      // Another account signed in, or the session ended — wipe so the next user
      // never sees this device's cached business data.
      if (prev && prev !== userId) {
        try {
          await clearLocalUserData(queryClient);
        } catch (e) {
          console.error('Failed to clear local data on session change', e);
        }
        if (cancelled) return;
      } else if (!userId && prev) {
        try {
          await clearLocalUserData(queryClient);
        } catch (e) {
          console.error('Failed to clear local data on sign-out', e);
        }
        if (cancelled) return;
      }

      if (userId) {
        connectSync().catch((e) => console.error('PowerSync connect failed', e));
      }
      prevUserIdRef.current = userId;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, ready]);

  // Mobile PWAs lose WebSocket sync when backgrounded — reconnect on wake / online.
  React.useEffect(() => {
    if (!cloudConfigured || !ready) return;

    const onWake = () => reconnectSyncIfNeeded(sessionRef.current);

    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [ready]);

  const signOut = React.useCallback(async () => {
    if (!supabase) return;
    // Wipe local SQLite + upload queue + query cache first so a different user
    // on this device never sees (or accidentally re-uploads) this account's data.
    try {
      await clearLocalUserData(queryClient);
    } catch (e) {
      console.error('Failed to clear local data on sign out', e);
      throw e;
    }
    prevUserIdRef.current = null;
    await supabase.auth.signOut();
  }, []);

  if (initError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="app-surface max-w-md p-6">
          <p className="text-sm font-semibold">Could not start</p>
          <p className="mt-1 text-xs text-muted-foreground">{initError}</p>
        </div>
      </div>
    );
  }

  if (!ready || authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <PageSpinner />
      </div>
    );
  }

  return (
    <PowerSyncContext.Provider value={db}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ session, signOut }}>
          {cloudConfigured && !session ? <LoginScreen /> : children}
        </AuthContext.Provider>
      </QueryClientProvider>
    </PowerSyncContext.Provider>
  );
}
