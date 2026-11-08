import { LM, type Lm } from './types';
import { seen, torsoLength } from './geometry';

const POINTS = [LM.leftWrist, LM.rightWrist, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle, LM.nose];

/** Movement over a rolling window, in torso lengths per second, so distance from the camera does not matter. */
export class MotionMeter {
  private hist: { t: number; pts: ({ x: number; y: number } | null)[]; torso: number }[] = [];
  constructor(private windowMs = 2000) {}
  update(tMs: number, lm: Lm[]): number {
    const torso = torsoLength(lm);
    this.hist.push({ t: tMs, pts: POINTS.map((i) => (seen(lm[i]) ? { x: lm[i].x, y: lm[i].y } : null)), torso });
    while (this.hist.length && tMs - this.hist[0].t > this.windowMs) this.hist.shift();
    let travelled = 0;
    for (let n = 1; n < this.hist.length; n++) {
      const a = this.hist[n - 1], b = this.hist[n];
      for (let i = 0; i < POINTS.length; i++) if (a.pts[i] && b.pts[i]) travelled += Math.hypot(b.pts[i]!.x - a.pts[i]!.x, b.pts[i]!.y - a.pts[i]!.y);
    }
    const span = (tMs - this.hist[0].t) / 1000;
    const ref = torso > 0.02 ? torso : 0.2;
    return span > 0.3 ? travelled / ref / span / POINTS.length : 0;
  }
  reset() { this.hist = []; }
}
export const MOVING_THRESHOLD = 0.25; // torso lengths per second per tracked point, averaged
