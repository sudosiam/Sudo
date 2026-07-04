import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { db } from './db';
import { supabase, cloudConfigured } from './supabase';
import { ensureSeeded } from '../domain/seed';
import { startCloudSync, stopCloudSync, reconnectCloudSync } from './cloudSync';
import { clearLocalUserData } from '../lib/localWipe';
import { LoginScreen } from './LoginScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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

  const userId = session?.user?.id ?? null;
  React.useEffect(() => {
    if (!cloudConfigured || !ready) return;

    const prev = prevUserIdRef.current;
    if (prev === userId) return;

    let cancelled = false;
    (async () => {
      stopCloudSync();

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
        startCloudSync(userId).catch((e) => console.error('Cloud sync start failed', e));
      }
      prevUserIdRef.current = userId;
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, ready]);

  React.useEffect(() => {
    if (!cloudConfigured || !ready) return;

    const onWake = () => reconnectCloudSync().catch((e) => console.error('Cloud reconnect failed', e));

    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [ready]);

  const signOut = React.useCallback(async () => {
    if (!supabase) return;
    stopCloudSync();
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

  if (!ready || authLoading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ session, signOut }}>
        {cloudConfigured && !session ? <LoginScreen /> : children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
