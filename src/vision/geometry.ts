import { LM, type Lm } from './types';

export const VISIBLE = 0.5;
export const seen = (p: Lm | undefined): p is Lm => !!p && (p.v ?? 1) >= VISIBLE;

/** Interior angle at b, in degrees, between the segments b-a and b-c. */
export function angle(a: Lm, b: Lm, c: Lm): number {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (m === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
}

const mid = (a: Lm, b: Lm): Lm => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Shoulder-to-hip length, used to make every distance independent of how far away the phone is. */
export function torsoLength(lm: Lm[]): number {
  const s = mid(lm[LM.leftShoulder], lm[LM.rightShoulder]);
  const h = mid(lm[LM.leftHip], lm[LM.rightHip]);
  return Math.hypot(s.x - h.x, s.y - h.y);
}
export const hipMid = (lm: Lm[]): Lm => mid(lm[LM.leftHip], lm[LM.rightHip]);
