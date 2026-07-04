import * as React from 'react';
import { LogIn, UserPlus, Eye, EyeOff, Mail } from 'lucide-react';
import { supabase } from './supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { haptic } from '../lib/haptics';

type Mode = 'signin' | 'signup' | 'forgot';

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'Wrong email or password. Check both and try again.';
  }
  if (m.includes('email not confirmed')) {
    return 'Confirm your email first — check your inbox for the confirmation link.';
  }
  if (m.includes('user already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (m.includes('password should be at least')) {
    return 'Password must be at least 6 characters.';
  }
  if (m.includes('unable to validate email')) {
    return 'Enter a valid email address.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts — wait a minute and try again.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message;
}

export function LoginScreen() {
  const [mode, setMode] = React.useState<Mode>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        haptic('success');
        setInfo('If that email is registered, you will receive a reset link shortly.');
        return;
      }
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
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Something went wrong'));
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

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-success">{info}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {mode === 'forgot' ? <Mail /> : mode === 'signin' ? <LogIn /> : <UserPlus />}
            {mode === 'forgot'
              ? 'Send reset link'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </Button>

          {mode === 'signin' && (
            <button
              type="button"
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
          )}

          {mode === 'forgot' ? (
            <button
              type="button"
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => switchMode('signin')}
            >
              Back to sign in
            </button>
          ) : (
            <button
              type="button"
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'First time? Create an account' : 'Already have an account? Sign in'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
