import { supabase } from '../system/supabase';

/** Delete all synced cloud rows for the signed-in user (single RPC, no upload queue). */
export async function wipeCloudUserData(): Promise<void> {
  if (!supabase) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.rpc('factory_reset_user');
  if (error) {
    const msg = error.message ?? 'Cloud wipe failed';
    if (/factory_reset_user|schema cache|function/i.test(msg)) {
      throw new Error(
        'Cloud wipe is not set up — run supabase/migrations/20260704_factory_reset_rpc.sql in the Supabase SQL Editor (see SETUP.md).',
      );
    }
    throw new Error(msg);
  }
}
