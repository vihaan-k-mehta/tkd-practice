export interface GateConfig { searchAfter: number; resumeAfter: number; idleAfter: number; failAfter: number }
export interface Profile {
  minVis: number;      // how confident a landmark must be to count as seen
  moving: number;      // movement level (torso lengths per second per tracked point) that counts as moving
  gate: GateConfig;
}
export type Sensitivity = 'relaxed' | 'normal' | 'strict';

/** `strict` is exactly the build guide's values. Relaxed is the default: it forgives short dropouts and slow movement. */
export const PROFILES: Record<Sensitivity, Profile> = {
  relaxed: { minVis: 0.3, moving: 0.1, gate: { searchAfter: 3000, resumeAfter: 300, idleAfter: 10000, failAfter: 90000 } },
  normal: { minVis: 0.4, moving: 0.16, gate: { searchAfter: 1500, resumeAfter: 400, idleAfter: 6000, failAfter: 75000 } },
  strict: { minVis: 0.5, moving: 0.25, gate: { searchAfter: 1000, resumeAfter: 500, idleAfter: 5000, failAfter: 60000 } },
};

/** A learned movement threshold, if the person trained one, wins over the profile's default. */
export const profileFor = (s: Sensitivity, learnedMove?: number): Profile => ({ ...PROFILES[s], moving: learnedMove ?? PROFILES[s].moving });

export interface Learned { ok: boolean; presentRate: number; moveThreshold: number; advice: string }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Turns a short capture of someone doing their normal exercise into settings that fit them:
 * how often they were seen, and how much movement counts as "moving" for them.
 */
export function learnFromSamples(samples: { present: boolean; motion: number }[]): Learned {
  if (samples.length < 10) return { ok: false, presentRate: 0, moveThreshold: PROFILES.relaxed.moving, advice: 'Not enough was captured. Try again.' };
  const seenFrames = samples.filter((s) => s.present);
  const presentRate = seenFrames.length / samples.length;
  if (presentRate < 0.6) {
    return { ok: false, presentRate, moveThreshold: PROFILES.relaxed.moving, advice: 'I could not see you for much of that. Move the phone farther away or to a better angle, add light in front of you, and try again.' };
  }
  const m = seenFrames.map((s) => s.motion).sort((a, b) => a - b);
  const p25 = m[Math.floor(m.length * 0.25)];
  // Half of your quieter movement still counts, so normal exercise is never flagged as idle.
  return { ok: true, presentRate, moveThreshold: Number(clamp(p25 * 0.5, 0.04, 0.3).toFixed(3)), advice: presentRate < 0.9 ? 'Mostly good. A little more light or a steadier phone would help.' : 'Tracking looks good for this setup.' };
}
