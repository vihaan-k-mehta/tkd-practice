import { useEffect, useState } from 'preact/hooks';
import { LogIn, LogOut, UserPlus } from 'lucide-preact';
import { cleanDisplayName, isEmail, lockLeft, MAX_TRIES, passwordProblem } from '../data/authRules';
import { loadProfile, saveProfile, signIn, signOut, signUp, useAuth } from '../data/auth';

/** Optional account: email and password. The app works fully without signing in. */
export function Account() {
  const { user, ready } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [fails, setFails] = useState(0);
  const [lastFail, setLastFail] = useState<number | undefined>();
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (user) loadProfile(user.id).then(setName).catch(() => {}); }, [user?.id]);

  const lock = lockLeft(fails, lastFail, now);
  const failed = () => { setFails((n) => n + 1); setLastFail(Date.now()); setNow(Date.now()); };

  const submit = async () => {
    if (lock > 0) return;
    if (!isEmail(email)) { setMsg('Enter a valid email address.'); return; }
    if (mode === 'up') {
      const problem = passwordProblem(pw, email);
      if (problem) { setMsg(problem); return; }
    } else if (!pw) { setMsg('Enter your password.'); return; }
    setBusy(true); setMsg('');
    const { data, error } = mode === 'in' ? await signIn(email, pw) : await signUp(email, pw);
    setBusy(false);
    if (error) {
      failed();
      // One vague message for sign-in, so this screen cannot be used to find out which emails have accounts.
      setMsg(error.status === 429 ? 'Too many tries. Wait a minute, then try again.'
        : mode === 'in' ? 'That email and password did not match.' : 'Could not create that account. Try a different email or sign in.');
      return;
    }
    setPw(''); setFails(0);
    if (mode === 'up' && !data.session) setMsg('Account created. Check your email to confirm it, then sign in.');
  };

  if (!ready) return <p class="sub">Checking sign-in...</p>;

  if (user) {
    return (
      <>
        <ul class="rowlist"><li><span class="grow">Signed in<span class="sub block">{user.email}</span></span></li></ul>
        <label class="eyebrow" for="dname">Name on the leaderboard</label>
        <input id="dname" class="field" maxLength={20} value={name} placeholder="Pick a name"
          onInput={(e) => { setName(cleanDisplayName((e.target as HTMLInputElement).value)); setSaved(false); }} />
        <div class="two" style={{ marginTop: '12px' }}>
          <button class="select" onClick={async () => { const { error } = await saveProfile(user.id, name); setSaved(!error); setMsg(error ? 'Could not save your name.' : ''); }}>Save name</button>
          <button class="select" onClick={() => signOut()}>Sign out<LogOut size={20} aria-hidden="true" /></button>
        </div>
        {saved && <p class="sub note" role="status">Saved.</p>}
        {msg && <p class="sub note warn" role="alert">{msg}</p>}
      </>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      <p class="sub">Optional. An account lets you join a leaderboard later. Everything else works without one.</p>
      <div class="seg-row" role="tablist" style={{ marginTop: '12px' }}>
        <button type="button" role="tab" aria-selected={mode === 'in'} class={`seg ${mode === 'in' ? 'on' : ''}`} onClick={() => { setMode('in'); setMsg(''); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} class={`seg ${mode === 'up' ? 'on' : ''}`} onClick={() => { setMode('up'); setMsg(''); }}>Create account</button>
      </div>
      <label class="eyebrow" for="email">Email</label>
      <input id="email" class="field" type="email" inputMode="email" autocomplete="email" maxLength={254} value={email}
        onInput={(e) => setEmail((e.target as HTMLInputElement).value)} placeholder="you@example.com" />
      <label class="eyebrow" for="pw">Password</label>
      <input id="pw" class="field" type="password" autocomplete={mode === 'in' ? 'current-password' : 'new-password'} maxLength={72} value={pw}
        onInput={(e) => setPw((e.target as HTMLInputElement).value)} placeholder={mode === 'up' ? 'At least 10 characters' : 'Your password'} />
      <button class="btn-primary" type="submit" style={{ marginTop: '14px' }} disabled={busy || lock > 0}>
        {mode === 'in' ? <LogIn size={22} aria-hidden="true" /> : <UserPlus size={22} aria-hidden="true" />}
        {lock > 0 ? `Try again in ${lock} s` : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      {fails >= MAX_TRIES - 1 && lock === 0 && <p class="sub note">One more wrong try will pause sign-in for a minute.</p>}
      {msg && <p class="sub note" role="status">{msg}</p>}
    </form>
  );
}
