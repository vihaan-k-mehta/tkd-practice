import { describe, expect, it } from 'vitest';
import { packFrame, unpackFrame, toFrames, KEY_IDX, type Sample } from '../src/vision/samples';
import { tuneExercise } from '../src/vision/tuning';
import { Tracker } from '../src/vision/tracker';
import { DEFAULT_REP_CONFIG } from '../src/vision/repCounter';
import { LM } from '../src/vision/types';
import { evenKicks, synthClip } from './helpers/synth';

const sampleOf = (exerciseId: string, leg: Sample['leg'], expected: number, clip: ReturnType<typeof synthClip>, id = exerciseId + leg): Sample =>
  ({ id, exerciseId, leg, expected, fps: 15, createdAt: 1, frames: clip.map((f) => packFrame(f.t, f.lm)) });

describe('packing recordings: body points only, small, and faithful', () => {
  const clip = synthClip({ seconds: 20, kicks: evenKicks(5, 'left', 1, 3), seed: 9 });
  it('keeps only the joints that matter and rounds them', () => {
    const p = packFrame(1234.6, clip[10].lm);
    expect(p[0]).toBe(1235);
    expect(p.length).toBe(1 + KEY_IDX.length * 3);
    expect(p.every(Number.isInteger)).toBe(true);
  });
  it('unpacks to the same positions within a thousandth', () => {
    const f = unpackFrame(packFrame(500, clip[10].lm));
    expect(f.lm![LM.leftKnee].x).toBeCloseTo(clip[10].lm[LM.leftKnee].x, 2);
    expect(f.lm![LM.leftAnkle].y).toBeCloseTo(clip[10].lm[LM.leftAnkle].y, 2);
  });
  it('a frame with nobody in it is just a time', () => {
    expect(packFrame(10, null)).toEqual([10]);
    expect(unpackFrame([10])).toEqual({ t: 10, lm: null });
  });
  it('counting kicks after packing gives the same answer as before packing', () => {
    const before = new Tracker(); clip.forEach((f) => before.update(f.t, f.lm));
    const after = new Tracker(); toFrames(sampleOf('roundhouse', 'left', 5, clip)).forEach((f) => after.update(f.t, f.lm));
    expect(after.reps).toEqual(before.reps);
  });
  it('a 25 second recording stays small enough to store and upload', () => {
    const big = synthClip({ seconds: 25, kicks: evenKicks(5, 'left', 1, 3) });
    expect(JSON.stringify(big.map((f) => packFrame(f.t, f.lm))).length).toBeLessThan(200_000);
  });
});

describe('tuneExercise: fit the tracker to how you do one exercise', () => {
  it('leaves standard settings alone when they already count right', () => {
    const s = sampleOf('roundhouse', 'left', 5, synthClip({ seconds: 20, kicks: evenKicks(5, 'left', 1, 3), seed: 1 }));
    const t = tuneExercise('roundhouse', [s]);
    expect(t.kickCfg).toBeUndefined();
    expect(t.after.counted).toBe(5);
    expect(t.ok).toBe(true);
  });
  it('relaxes the settings when your kicks are low, and says what changed', () => {
    const s = sampleOf('roundhouse', 'left', 5, synthClip({ seconds: 20, kicks: evenKicks(5, 'left', 1, 3, { peak: 80, reach: 165 }), seed: 2 }));
    const t = tuneExercise('roundhouse', [s]);
    expect(t.before.counted).toBeLessThan(5);
    expect(t.after.counted).toBe(5);
    expect(t.kickCfg!.kickHeight!).toBeLessThan(DEFAULT_REP_CONFIG.kickHeight);
    expect(t.ok).toBe(true);
  });
  it('uses every recording of that exercise together, so one odd take does not decide', () => {
    const lowL = sampleOf('roundhouse', 'left', 5, synthClip({ seconds: 20, kicks: evenKicks(5, 'left', 1, 3, { peak: 80, reach: 165 }), seed: 3 }), 'a');
    const lowR = sampleOf('roundhouse', 'right', 5, synthClip({ seconds: 20, kicks: evenKicks(5, 'right', 1, 3, { peak: 80, reach: 165 }), seed: 4 }), 'b');
    const t = tuneExercise('roundhouse', [lowL, lowR]);
    expect(t.samples).toBe(2);
    expect(t.after.counted).toBe(10);
  });
  it('does not count the leg you did not kick with', () => {
    const s = sampleOf('roundhouse', 'left', 5, synthClip({ seconds: 20, kicks: evenKicks(5, 'left', 1, 3), seed: 5 }));
    const t = tuneExercise('roundhouse', [s]);
    expect(t.after.extra).toBe(0);
  });
  it('for a stretch or warm-up it learns how you move instead of kicks', () => {
    const still = synthClip({ seconds: 12, kicks: [], seed: 6 });
    const t = tuneExercise('hamstring', [sampleOf('hamstring', 'both', 0, still)]);
    expect(t.kickCfg).toBeUndefined();
    expect(t.motionThreshold).toBeGreaterThanOrEqual(0.02);
    expect(t.motionThreshold).toBeLessThanOrEqual(0.5);
  });
  it('does not learn from a recording where you were not seen', () => {
    const empty = Array.from({ length: 150 }, (_, i) => ({ t: i * 66, lm: null }));
    const t = tuneExercise('hamstring', [{ id: 'x', exerciseId: 'hamstring', leg: 'both', expected: 0, fps: 15, createdAt: 1, frames: empty.map((f) => packFrame(f.t, f.lm)) }]);
    expect(t.motionThreshold).toBeUndefined();
    expect(t.ok).toBe(false);
    expect(t.advice).toMatch(/could not see|phone|light/i);
  });
  it('says plainly when it cannot get your kick count right', () => {
    const s = sampleOf('roundhouse', 'left', 5, synthClip({ seconds: 20, kicks: [], seed: 7 }));
    const t = tuneExercise('roundhouse', [s]);
    expect(t.ok).toBe(false);
    expect(t.kickCfg).toBeUndefined();
    expect(t.advice).toMatch(/did not see|no kicks|side/i);
  });
});
