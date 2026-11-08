import { OneEuro } from './filters';
import { bodyInFrame, personPresent } from './framing';
import { MotionMeter, MOVING_THRESHOLD } from './motion';
import type { Profile } from './profiles';
import { DEFAULT_REP_CONFIG, RepCounter, type RepConfig } from './repCounter';
import { seen, torsoLength } from './geometry';
import { LM, type Lm } from './types';

export interface LegInfo { planted: boolean; height: number }
export interface Frame { legs: { left: LegInfo | null; right: LegInfo | null }; present: boolean; inFrame: boolean; moving: boolean; motion: number; message: string; reps: { left: number; right: number }; newReps: { side: 'left' | 'right'; peakHeight: number }[] }

/** One pipeline: smooth the landmarks, check framing and movement, count kicks. Shared by the app, the debug page and the tests. */
export class Tracker {
  private filters: { x: OneEuro; y: OneEuro }[] = Array.from({ length: 33 }, () => ({ x: new OneEuro(), y: new OneEuro() }));
  private counter: RepCounter;
  private motion = new MotionMeter();
  constructor(cfg: RepConfig = { ...DEFAULT_REP_CONFIG }, private profile: Pick<Profile, 'minVis' | 'moving'> = { minVis: 0.35, moving: MOVING_THRESHOLD }) { this.counter = new RepCounter(cfg); }
  get reps() { return { ...this.counter.count }; }
  get config() { return this.counter.cfg; }
  reset() { this.counter.reset(); this.motion.reset(); this.filters.forEach((f) => { f.x.reset(); f.y.reset(); }); }

  update(tMs: number, raw: Lm[] | null): Frame {
    if (!raw) return { legs: { left: null, right: null }, present: false, inFrame: false, moving: false, motion: 0, message: 'I cannot see you. Step back a little or into the light.', reps: this.reps, newReps: [] };
    const lm = raw.map((p, i) => ({ ...p, x: this.filters[i].x.filter(p.x, tMs), y: this.filters[i].y.filter(p.y, tMs) }));
    const framing = bodyInFrame(raw);
    const motion = this.motion.update(tMs, lm);
    const newReps = this.counter.update(tMs, lm);
    return { legs: legInfo(lm), present: personPresent(raw, this.profile.minVis), inFrame: framing.ok, moving: motion > this.profile.moving, motion, message: framing.message, reps: this.reps, newReps };
  }
}

const PLANTED_BAND = 0.15; // ankles within this many torso lengths of each other means both feet are on the floor

/** For each leg: is the foot on the floor (level with the other foot), and how high is it above the other foot, in torso lengths. */
export function legInfo(lm: Lm[]): { left: LegInfo | null; right: LegInfo | null } {
  const l = lm[LM.leftAnkle], r = lm[LM.rightAnkle];
  const torso = torsoLength(lm);
  if (!seen(l) || !seen(r) || !(torso > 0.02)) return { left: null, right: null };
  const heightL = (r.y - l.y) / torso, heightR = (l.y - r.y) / torso;
  const planted = Math.abs(l.y - r.y) / torso < PLANTED_BAND;
  return { left: { planted, height: heightL }, right: { planted, height: heightR } };
}
