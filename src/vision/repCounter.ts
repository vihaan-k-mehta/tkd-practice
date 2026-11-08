import { angle, hipMid, seen, torsoLength } from './geometry';
import { LEG, type Lm, type Side } from './types';

/** Every threshold lives here so calibration can tune them. Distances are in torso lengths. */
export interface RepConfig {
  chamberAngle: number;   // knee angle under this counts as chambered
  extendAngle: number;    // knee angle over this counts as extended
  returnAngle: number;    // knee angle under this after an extension counts as the return (hysteresis gap below extendAngle)
  kneeUp: number;         // knee height above the hip needed to chamber (negative allows a little below)
  kickHeight: number;     // ankle height above the hip needed on extension (negative allows a little below)
  minGapMs: number;       // minimum time between counted reps
  chamberTimeoutMs: number;
  extendTimeoutMs: number;
}
export const DEFAULT_REP_CONFIG: RepConfig = {
  chamberAngle: 100, extendAngle: 150, returnAngle: 120, kneeUp: -0.1, kickHeight: -0.2,
  minGapMs: 250, chamberTimeoutMs: 3000, extendTimeoutMs: 1800,
};

type Phase = 'idle' | 'chamber' | 'extended';
interface LegState { phase: Phase; since: number; lastCount: number; peakHeight: number }

export interface RepResult { counted: boolean; peakHeight?: number }

/** Counts kicks per leg: chamber, then extension, then return. Counted at the return. */
export class RepCounter {
  count = { left: 0, right: 0 };
  private legs: Record<Side, LegState> = { left: this.fresh(), right: this.fresh() };
  constructor(public cfg: RepConfig = { ...DEFAULT_REP_CONFIG }) {}
  private fresh(): LegState { return { phase: 'idle', since: 0, lastCount: -1e9, peakHeight: -9 }; }
  reset() { this.count = { left: 0, right: 0 }; this.legs = { left: this.fresh(), right: this.fresh() }; }

  /** `lm` should already be smoothed. */
  update(tMs: number, lm: Lm[]): { side: Side; peakHeight: number }[] {
    const torso = torsoLength(lm);
    if (!(torso > 0.02)) return [];
    const hip = hipMid(lm);
    const events: { side: Side; peakHeight: number }[] = [];
    (['left', 'right'] as const).forEach((side) => {
      const ix = LEG[side];
      const h = lm[ix.hip], k = lm[ix.knee], a = lm[ix.ankle];
      if (!seen(h) || !seen(k) || !seen(a)) return; // cannot judge this leg this frame
      const st = this.legs[side];
      const ang = angle(h, k, a);
      const kneeUp = (hip.y - k.y) / torso;
      const height = (hip.y - a.y) / torso;
      const c = this.cfg;
      if (st.phase === 'idle') {
        if (ang < c.chamberAngle && kneeUp > c.kneeUp) { st.phase = 'chamber'; st.since = tMs; st.peakHeight = -9; }
      } else if (st.phase === 'chamber') {
        if (ang > c.extendAngle && height >= c.kickHeight) { st.phase = 'extended'; st.since = tMs; st.peakHeight = height; }
        else if (tMs - st.since > c.chamberTimeoutMs || (ang > c.extendAngle && kneeUp < c.kneeUp - 0.3)) st.phase = 'idle'; // gave up, or just straightened the leg low
      } else {
        st.peakHeight = Math.max(st.peakHeight, height);
        if (ang < c.returnAngle) {
          if (tMs - st.lastCount >= c.minGapMs) { this.count[side]++; st.lastCount = tMs; events.push({ side, peakHeight: st.peakHeight }); }
          st.phase = ang < c.chamberAngle && kneeUp > c.kneeUp ? 'chamber' : 'idle';
          st.since = tMs;
        } else if (tMs - st.since > c.extendTimeoutMs) st.phase = 'idle';
      }
    });
    return events;
  }
}
