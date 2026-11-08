import { LM, type Lm } from '../../src/vision/types';

/** Builds MediaPipe-style landmarks (normalized 0..1, y down) for a person kicking, seen from the side. Test-only. */
export interface Kick { at: number; leg: 'left' | 'right'; dur?: number; peak?: number; flex?: number; reach?: number }
export interface ClipOpts { seconds: number; kicks: Kick[]; torso?: number; fps?: number; noise?: number; seed?: number; cx?: number; jitterDrop?: number; bounce?: number }

const rnd = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);

/** 0 = standing, 1 = chambered, 2 = extended. Returns the pose of the kicking leg at time t within a kick of length dur. */
function kickPose(k: number, peak: number, flex: number, reach: number): { thigh: number; interior: number } {
  // k in 0..1: 0-0.3 up to chamber, 0.3-0.5 extend, 0.5-0.62 hold, 0.62-0.8 back to chamber, 0.8-1 down
  const stand = { thigh: 0, interior: 178 };
  const chamber = { thigh: 92, interior: flex };
  const ext = { thigh: peak, interior: reach };
  const mix = (a: typeof stand, b: typeof stand, u: number) => ({ thigh: lerp(a.thigh, b.thigh, ease(u)), interior: lerp(a.interior, b.interior, ease(u)) });
  if (k < 0.3) return mix(stand, chamber, k / 0.3);
  if (k < 0.5) return mix(chamber, ext, (k - 0.3) / 0.2);
  if (k < 0.62) return ext;
  if (k < 0.8) return mix(ext, chamber, (k - 0.62) / 0.18);
  return mix(chamber, stand, (k - 0.8) / 0.2);
}

export function synthClip(o: ClipOpts): { t: number; lm: Lm[] }[] {
  const fps = o.fps ?? 15, torso = o.torso ?? 0.22, noise = o.noise ?? 0.002, cx = o.cx ?? 0.5;
  const r = rnd(o.seed ?? 1);
  const out: { t: number; lm: Lm[] }[] = [];
  const thighL = 0.9 * torso, shankL = 0.9 * torso;
  for (let i = 0; i < o.seconds * fps; i++) {
    const t = (i / fps) * 1000;
    const bounce = (o.bounce ?? 0) * Math.sin((i / fps) * 6);
    const hip = { x: cx, y: 0.56 + bounce * torso };
    const sh = { x: cx, y: hip.y - torso };
    const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
    const put = (idx: number, p: { x: number; y: number }) => { lm[idx] = { x: p.x + gauss(r) * noise, y: p.y + gauss(r) * noise, v: 0.95 }; };
    put(LM.leftShoulder, { x: sh.x - 0.01, y: sh.y }); put(LM.rightShoulder, { x: sh.x + 0.01, y: sh.y });
    put(LM.leftHip, { x: hip.x - 0.01, y: hip.y }); put(LM.rightHip, { x: hip.x + 0.01, y: hip.y });
    put(LM.leftWrist, { x: sh.x - 0.03, y: sh.y + 0.6 * torso }); put(LM.rightWrist, { x: sh.x + 0.03, y: sh.y + 0.6 * torso });
    put(LM.nose, { x: sh.x, y: sh.y - 0.35 * torso });
    for (const leg of ['left', 'right'] as const) {
      let thigh = 0, interior = 178;
      for (const kk of o.kicks) {
        if (kk.leg !== leg) continue;
        const dur = (kk.dur ?? 1.4) * 1000;
        if (t >= kk.at * 1000 && t < kk.at * 1000 + dur) ({ thigh, interior } = kickPose((t - kk.at * 1000) / dur, kk.peak ?? 100, kk.flex ?? 70, kk.reach ?? 174));
      }
      const a = (thigh * Math.PI) / 180;
      const knee = { x: hip.x + Math.sin(a) * thighL, y: hip.y + Math.cos(a) * thighL };
      const shankDir = ((thigh - (180 - interior)) * Math.PI) / 180;
      const ankle = { x: knee.x + Math.sin(shankDir) * shankL, y: knee.y + Math.cos(shankDir) * shankL };
      put(leg === 'left' ? LM.leftKnee : LM.rightKnee, knee);
      put(leg === 'left' ? LM.leftAnkle : LM.rightAnkle, ankle);
    }
    if (o.jitterDrop && r() < o.jitterDrop) for (const idx of [LM.leftAnkle, LM.rightAnkle]) lm[idx].v = 0.2; // occasional lost ankle
    out.push({ t, lm });
  }
  return out;
}

/** n kicks with one leg starting at `start`, `gap` seconds apart. */
export const evenKicks = (n: number, leg: 'left' | 'right', start = 1, gap = 2, extra: Partial<Kick> = {}): Kick[] =>
  Array.from({ length: n }, (_, i) => ({ at: start + i * gap, leg, ...extra }));
