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

const KEY = [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];

/**
 * Is there a person in view? Much more forgiving than bodyInFrame: it does not need every joint or the whole body,
 * so floor work, close-up phones and a hidden leg still count. It needs a torso plus a few other joints.
 */
export function personPresent(lm: Lm[] | null, minVis = 0.35): boolean {
  if (!lm) return false;
  const ok = (i: number) => (lm[i]?.v ?? 1) >= minVis;
  const torso = (ok(LM.leftShoulder) || ok(LM.rightShoulder)) && (ok(LM.leftHip) || ok(LM.rightHip));
  if (!torso) return false;
  return KEY.filter(ok).length >= 5;
}
