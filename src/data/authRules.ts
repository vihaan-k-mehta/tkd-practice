/** Pure input rules for sign-in. The server enforces its own limits too; these just give quick, kind feedback. */
export const isEmail = (v: string): boolean => {
  const s = v.trim();
  return s.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
};
export const isOtp = (v: string): boolean => /^\d{6,8}$/.test(v.replace(/\s/g, ''));
export const cleanDisplayName = (v: string): string => v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20);
export const RESEND_SEC = 60;
/** Seconds until another code may be requested. */
export const cooldownLeft = (sentAt: number | undefined, now: number): number =>
  sentAt === undefined ? 0 : Math.max(0, Math.ceil(RESEND_SEC - (now - sentAt) / 1000));
