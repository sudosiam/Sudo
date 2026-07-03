import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const powersyncUrl = import.meta.env.VITE_POWERSYNC_URL as string | undefined;

/** True once the user has filled in .env.local (see SETUP.md). */
export const cloudConfigured = Boolean(url && anonKey && powersyncUrl);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
