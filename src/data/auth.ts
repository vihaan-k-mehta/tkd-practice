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

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
/** Where a confirmation email should bring the person back to: this app, wherever it is hosted. */
export const appUrl = () => `${location.origin}${(import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL}`;
export const signUp = (email: string, password: string) =>
  supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: appUrl() } });

/**
 * Handles landing from a confirmation email: the link brings a ?code=... (or an error) back to the app.
 * The link usually opens in Safari, which is a different place from an installed home-screen app,
 * so the sign-in cannot always finish there. Either way the email is confirmed and a password sign-in works.
 */
export async function handleEmailLanding(): Promise<'confirmed' | 'error' | null> {
  const q = new URLSearchParams(location.search);
  const h = new URLSearchParams(location.hash.replace(/^#\/?[^?]*\??/, ''));
  const code = q.get('code');
  const failed = q.get('error') || q.get('error_code') || h.get('error') || h.get('error_code');
  if (!code && !failed) return null;
  const clean = () => history.replaceState(null, '', `${location.pathname}${location.hash}`);
  if (failed) { clean(); return 'error'; }
  try { await supabase.auth.exchangeCodeForSession(code!); } catch { /* opened in a different browser: confirmed, but sign in with the password */ }
  clean();
  return 'confirmed';
}
export const signOut = () => supabase.auth.signOut();

export async function loadProfile(uid: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle();
  return data?.display_name ?? '';
}
export const saveProfile = (uid: string, name: string) =>
  supabase.from('profiles').upsert({ id: uid, display_name: cleanDisplayName(name) });
