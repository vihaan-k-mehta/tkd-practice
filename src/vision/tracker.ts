import { OneEuro } from './filters';
import { bodyInFrame } from './framing';
import { MotionMeter, MOVING_THRESHOLD } from './motion';
import { DEFAULT_REP_CONFIG, RepCounter, type RepConfig } from './repCounter';
import type { Lm } from './types';

export interface Frame { present: boolean; inFrame: boolean; moving: boolean; motion: number; message: string; reps: { left: number; right: number }; newReps: { side: 'left' | 'right'; peakHeight: number }[] }

/** One pipeline: smooth the landmarks, check framing and movement, count kicks. Shared by the app, the debug page and the tests. */
export class Tracker {
  private filters: { x: OneEuro; y: OneEuro }[] = Array.from({ length: 33 }, () => ({ x: new OneEuro(), y: new OneEuro() }));
  private counter: RepCounter;
  private motion = new MotionMeter();
  constructor(cfg: RepConfig = { ...DEFAULT_REP_CONFIG }) { this.counter = new RepCounter(cfg); }
  get reps() { return { ...this.counter.count }; }
  get config() { return this.counter.cfg; }
  reset() { this.counter.reset(); this.motion.reset(); this.filters.forEach((f) => { f.x.reset(); f.y.reset(); }); }

  update(tMs: number, raw: Lm[] | null): Frame {
    if (!raw) return { present: false, inFrame: false, moving: false, motion: 0, message: 'Step back so your whole body is in view.', reps: this.reps, newReps: [] };
    const lm = raw.map((p, i) => ({ ...p, x: this.filters[i].x.filter(p.x, tMs), y: this.filters[i].y.filter(p.y, tMs) }));
    const framing = bodyInFrame(raw);
    const motion = this.motion.update(tMs, lm);
    const newReps = this.counter.update(tMs, lm);
    return { present: framing.ok, inFrame: framing.ok, moving: motion > MOVING_THRESHOLD, motion, message: framing.message, reps: this.reps, newReps };
  }
}
