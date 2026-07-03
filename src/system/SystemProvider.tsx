import * as React from 'react';
import { PowerSyncContext } from '@powersync/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { db } from './db';
import { supabase, cloudConfigured } from './supabase';
import { SupabaseConnector } from './connector';
import { ensureSeeded } from '../domain/seed';
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
  const connectedRef = React.useRef(false);

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
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!cloudConfigured || !ready) return;
    if (session && !connectedRef.current) {
      connectedRef.current = true;
      db.connect(new SupabaseConnector()).catch((e) => {
        console.error('PowerSync connect failed', e);
        connectedRef.current = false;
      });
    } else if (!session && connectedRef.current) {
      connectedRef.current = false;
      db.disconnect().catch(console.error);
    }
  }, [session, ready]);

  const signOut = React.useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
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

  // Cloud configured but not signed in -> login wall
  if (cloudConfigured && !session) {
    return <LoginScreen />;
  }

  return (
    <PowerSyncContext.Provider value={db}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ session, signOut }}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    </PowerSyncContext.Provider>
  );
}
