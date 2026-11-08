import { createClient } from '@supabase/supabase-js';

// Public by design: the publishable key only does what row level security allows. Never use a service_role key in the app.
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
const URL = env.VITE_SUPABASE_URL ?? 'https://hjpxizzynmfgqilrdjqp.supabase.co';
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_sDbL-2s8RJKHKvxafqatjA_FSFN0S3h';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
});
