import { LM, type Lm } from './types';

/**
 * A recording of you doing an exercise, for tuning. It holds body points only: never video or an image.
 * Only the joints that matter are kept, rounded, so a 25 second take is well under 200 KB.
 */
export const KEY_IDX: number[] = [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle, LM.leftHeel, LM.rightHeel, LM.leftFoot, LM.rightFoot];

/** [time in ms, then x, y, visibility for each key joint, as integers]. Just [time] when nobody was in view. */
export type Packed = number[];

export function packFrame(t: number, lm: Lm[] | null): Packed {
  const out: Packed = [Math.round(t)];
  if (!lm) return out;
  for (const i of KEY_IDX) { const p = lm[i]; out.push(Math.round(p.x * 1000), Math.round(p.y * 1000), Math.round((p.v ?? 1) * 10)); }
  return out;
}

export function unpackFrame(p: Packed): { t: number; lm: Lm[] | null } {
  if (p.length < 1 + KEY_IDX.length * 3) return { t: p[0], lm: null };
  const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
  KEY_IDX.forEach((idx, k) => { const o = 1 + k * 3; lm[idx] = { x: p[o] / 1000, y: p[o + 1] / 1000, v: p[o + 2] / 10 }; });
  return { t: p[0], lm };
}

export interface Sample {
  id: string;
  exerciseId: string;
  /** Which leg did the work. `both` for things with no sides. */
  leg: 'left' | 'right' | 'both';
  /** How many reps you really did (for holds, 0). */
  expected: number;
  fps: number;
  createdAt: number;
  note?: string;
  frames: Packed[];
}

export const toFrames = (s: Sample) => s.frames.map(unpackFrame);

export const MAX_SAMPLE_SEC = 60;

/** Cut the last `seconds` out of the rolling buffer as a recording, with the clock restarted at zero. */
export function sampleFromBuffer(buf: Packed[], o: { exerciseId: string; leg: Sample['leg']; expected: number; seconds: number; now: number; id: string; fps: number; note?: string }): Sample {
  const secs = Math.max(1, Math.min(MAX_SAMPLE_SEC, o.seconds));
  const from = o.now - secs * 1000;
  const kept = buf.filter((f) => f[0] >= from && f[0] <= o.now);
  const t0 = kept.length ? kept[0][0] : 0;
  return {
    id: o.id, exerciseId: o.exerciseId, leg: o.leg, expected: Math.max(0, Math.min(100, Math.round(o.expected))), fps: o.fps, createdAt: Date.now(), note: o.note?.slice(0, 200),
    frames: kept.map((f) => [f[0] - t0, ...f.slice(1)]),
  };
}
