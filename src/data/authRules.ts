/** Pure input rules for sign-in. The server enforces its own limits too; these give quick, kind feedback. */
export const isEmail = (v: string): boolean => {
  const s = v.trim();
  return s.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
};

const COMMON = ['password', 'passw0rd', '1234567890', 'qwertyuiop', 'iloveyou12', 'letmein123', 'taekwondo'];
/** Empty string means the password is fine; otherwise a short reason. */
export function passwordProblem(pw: string, email: string): string {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (new TextEncoder().encode(pw).length > 72 || pw.length > 72) return 'That password is too long (72 characters at most).';
  if (new Set(pw).size < 5) return 'Use a more different mix of characters.';
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) return 'That password is too common. Try a few random words.';
  const name = email.trim().toLowerCase().split('@')[0];
  if (name.length >= 3 && low.includes(name)) return 'Do not use your email name in your password.';
  return '';
}

export const cleanDisplayName = (v: string): string => v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20);

export const MAX_TRIES = 5;
export const LOCK_SEC = 60;
/** Seconds sign-in stays locked after too many failed tries. */
export const lockLeft = (failures: number, lastFailAt: number | undefined, now: number): number =>
  failures < MAX_TRIES || lastFailAt === undefined ? 0 : Math.max(0, Math.ceil(LOCK_SEC - (now - lastFailAt) / 1000));
