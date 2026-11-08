/** Tiny 2D skeleton. Angles are degrees: 0 points straight down, +90 points forward (or outward in front view). */
export interface Pose {
  tor: number; x: number; y: number; fold: number;
  nh: number; nk: number; nf: number; // near leg: hip, knee bend, foot tilt
  fh: number; fk: number; ff: number; // far leg
  ns: number; ne: number; fs: number; fe: number; // shoulder and elbow, near and far arm
}
export type View = 'side' | 'front';
export type Prop = 'bag' | 'wall' | 'weights' | 'band' | 'rope' | 'floor';
export interface Frame { ms: number; pose: Pose }
export interface Anim { view: View; props: Prop[]; frames: Frame[]; label: string }
export type Pt = [number, number];
export interface Joints {
  head: Pt; neck: Pt; hip: Pt; nearHip: Pt; farHip: Pt;
  nearArm: [Pt, Pt, Pt]; farArm: [Pt, Pt, Pt];
  nearLeg: [Pt, Pt, Pt, Pt]; farLeg: [Pt, Pt, Pt, Pt]; // hip, knee, ankle, toe
}

export const DEFAULT_POSE: Pose = {
  tor: 0, x: 0, y: 0, fold: 0, nh: 0, nk: 0, nf: 0, fh: 0, fk: 0, ff: 0, ns: 8, ne: 15, fs: -8, fe: 10,
};
export const VIEWBOX = { x: 0, y: -14, w: 120, h: 132 };

const L = { torso: 34, head: 14, up: 17, fore: 16, thigh: 24, shank: 24, foot: 8 };
const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number): Pt => [Math.sin(rad(deg)), Math.cos(rad(deg))]; // 0 = down, 90 = +x
const add = (p: Pt, d: Pt, len: number): Pt => [p[0] + d[0] * len, p[1] + d[1] * len];

export function joints(p: Pose, view: View): Joints {
  const cx = (view === 'side' ? 56 : 60) + p.x;
  const hip: Pt = [cx, 64 + p.y];
  const up: Pt = [Math.sin(rad(p.tor)), -Math.cos(rad(p.tor))];
  const tl = L.torso * (view === 'front' ? 1 - 0.55 * p.fold : 1);
  const neck = add(hip, up, tl);
  const head = add(neck, up, L.head * (view === 'front' ? 1 - 0.3 * p.fold : 1));
  const spread = view === 'front' ? 8 : 0;
  const hs = view === 'front' ? 4 : 0;
  const nearHip: Pt = [hip[0] + hs, hip[1]];
  const farHip: Pt = [hip[0] - hs, hip[1]];
  const sgn = (s: number): number => (view === 'front' ? s : 1);

  const arm = (from: Pt, s: number, e: number, side: 1 | -1): [Pt, Pt, Pt] => {
    const a = side === -1 && view === 'front' ? -s : s;
    const b = side === -1 && view === 'front' ? -(s + e) : s + e;
    const elbow = add(from, dir(a), L.up);
    return [from, elbow, add(elbow, dir(b), L.fore)];
  };
  const leg = (from: Pt, h: number, k: number, f: number, side: 1 | -1): [Pt, Pt, Pt, Pt] => {
    const flip = side === -1 && view === 'front';
    const a = flip ? -h : h;
    const b = flip ? -(h - k) : h - k;
    const knee = add(from, dir(a), L.thigh);
    const ankle = add(knee, dir(b), L.shank);
    const footDir = view === 'front' ? ([flip ? -1 : 1, 0.25] as Pt) : dir((h - k) + 90 + f);
    return [from, knee, ankle, add(ankle, footDir, view === 'front' ? 5 : L.foot)];
  };
  void sgn;
  return {
    head, neck, hip, nearHip, farHip,
    nearArm: arm([neck[0] + spread, neck[1]], p.ns, p.ne, 1),
    farArm: arm([neck[0] - spread, neck[1]], p.fs, p.fe, -1),
    nearLeg: leg(nearHip, p.nh, p.nk, p.nf, 1),
    farLeg: leg(farHip, p.fh, p.fk, p.ff, -1),
  };
}

const KEYS = Object.keys(DEFAULT_POSE) as (keyof Pose)[];
const smooth = (t: number) => t * t * (3 - 2 * t);

export const loopMs = (a: Anim) => a.frames.reduce((s, f) => s + f.ms, 0);

/** Pose at time t (ms), looping. Frame i takes frames[i].ms to reach, easing from the previous frame. */
export function poseAt(a: Anim, tMs: number): Pose {
  const total = loopMs(a);
  let t = ((tMs % total) + total) % total;
  const n = a.frames.length;
  for (let i = 0; i < n; i++) {
    const f = a.frames[i];
    if (t < f.ms) {
      const from = a.frames[(i + n - 1) % n].pose;
      const k = smooth(f.ms === 0 ? 1 : t / f.ms);
      const out = { ...f.pose };
      for (const key of KEYS) out[key] = from[key] + (f.pose[key] - from[key]) * k;
      return out;
    }
    t -= f.ms;
  }
  return a.frames[0].pose;
}
