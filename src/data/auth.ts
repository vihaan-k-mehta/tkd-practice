import { useEffect, useState } from 'preact/hooks';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { cleanDisplayName } from './authRules';

export interface AuthState { user: User | null; ready: boolean }

/** Current session, kept in sync with Supabase. The app never requires an account. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setState({ user: data.session?.user ?? null, ready: true }); })
      .catch(() => { if (alive) setState({ user: null, ready: true }); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setState({ user: session?.user ?? null, ready: true }));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return state;
}

export const sendCode = (email: string) =>
  supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
export const verifyCode = (email: string, code: string) =>
  supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ''), type: 'email' });
export const signOut = () => supabase.auth.signOut();

export async function loadProfile(uid: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle();
  return data?.display_name ?? '';
}
export const saveProfile = (uid: string, name: string) =>
  supabase.from('profiles').upsert({ id: uid, display_name: cleanDisplayName(name) });
