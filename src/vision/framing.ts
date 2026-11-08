import { LM, type Lm } from './types';
import { seen } from './geometry';

const NEEDED = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];

export interface Framing { ok: boolean; message: string }

/** Whole body in view, with enough confidence, and not cut off at the edge. */
export function bodyInFrame(lm: Lm[] | null, margin = 0.015): Framing {
  if (!lm) return { ok: false, message: 'Step back so your whole body is in view.' };
  for (const i of NEEDED) {
    const p = lm[i];
    if (!seen(p) || p.x < margin || p.x > 1 - margin || p.y < margin || p.y > 1 - margin) {
      return { ok: false, message: 'Step back so your whole body is in view.' };
    }
  }
  return { ok: true, message: 'Detected' };
}
