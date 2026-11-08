import { useEffect, useState } from 'preact/hooks';
import { LogIn, LogOut } from 'lucide-preact';
import { cleanDisplayName, cooldownLeft, isEmail, isOtp } from '../data/authRules';
import { loadProfile, saveProfile, sendCode, signOut, useAuth, verifyCode } from '../data/auth';

/** Sign in with an emailed 6-digit code. Typing a code works inside an installed home-screen app, unlike a link. */
export function Account() {
  const { user, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState<number | undefined>();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (user) loadProfile(user.id).then(setName).catch(() => {}); }, [user?.id]);

  const wait = cooldownLeft(sentAt, now);
  const send = async () => {
    if (!isEmail(email)) { setMsg('Enter a valid email address.'); return; }
    setBusy(true); setMsg('');
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) setMsg(error.status === 429 ? 'Too many tries. Wait a minute, then try again.' : 'Could not send the code. Check the address and try again.');
    else { setSentAt(Date.now()); setNow(Date.now()); setMsg('We emailed you a code. It expires in an hour.'); }
  };
  const verify = async () => {
    if (!isOtp(code)) { setMsg('The code is 6 to 8 digits.'); return; }
    setBusy(true); setMsg('');
    const { error } = await verifyCode(email, code);
    setBusy(false);
    if (error) setMsg('That code did not work. Check it, or send a new one.');
    else { setCode(''); setSentAt(undefined); setMsg(''); }
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
    <>
      <p class="sub">Optional. An account lets you join a leaderboard later. Everything else works without one.</p>
      <label class="eyebrow" for="email">Email</label>
      <input id="email" class="field" type="email" inputMode="email" autocomplete="email" maxLength={254} value={email}
        onInput={(e) => setEmail((e.target as HTMLInputElement).value)} placeholder="you@example.com" />
      <button class="btn-primary" style={{ marginTop: '12px' }} disabled={busy || wait > 0} onClick={send}>
        <LogIn size={22} aria-hidden="true" /> {sentAt === undefined ? 'Email me a code' : wait > 0 ? `Send again in ${wait} s` : 'Send a new code'}
      </button>
      {sentAt !== undefined && (
        <>
          <label class="eyebrow" for="otp">6-digit code</label>
          <input id="otp" class="field" inputMode="numeric" autocomplete="one-time-code" maxLength={10} value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)} placeholder="123456" />
          <button class="btn-primary" style={{ marginTop: '12px' }} disabled={busy} onClick={verify}>Sign in</button>
        </>
      )}
      {msg && <p class="sub note" role="status">{msg}</p>}
    </>
  );
}
