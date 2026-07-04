import * as React from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { supabase } from './supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { haptic } from '../lib/haptics';

export function LoginScreen() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        haptic('success');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        haptic('success');
        if (!data.session) setInfo('Check your email to confirm your account, then sign in.');
      }
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <img
            src="/icon-192.png"
            alt=""
            className="size-12 rounded-2xl shadow-md ring-1 ring-border"
          />
          <h1 className="text-xl font-semibold tracking-tight">Sudo</h1>
          <p className="text-xs text-muted-foreground">Premium offline-first business finance</p>
        </div>

        <form onSubmit={submit} className="app-surface space-y-3 p-5 sm:p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-success">{info}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {mode === 'signin' ? <LogIn /> : <UserPlus />}
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>

          <button
            type="button"
            className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            {mode === 'signin' ? "First time? Create an account" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
