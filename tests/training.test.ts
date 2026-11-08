import { describe, expect, it } from 'vitest';
import { analyze, STEPS, summarize, tuneKicks, type StepData } from '../src/vision/training';
import { DEFAULT_REP_CONFIG } from '../src/vision/repCounter';
import { evenKicks, synthClip } from './helpers/synth';

const samples = (n: number, o: { present?: boolean; inFrame?: boolean; motion?: number } = {}) =>
  Array.from({ length: n }, () => ({ present: o.present ?? true, inFrame: o.inFrame ?? true, motion: o.motion ?? 0.05 }));
const step = (id: StepData['id'], n: number, o = {}): StepData => ({ id, samples: samples(n, o) });
const good = (over: Partial<Record<StepData['id'], StepData>> = {}) => ({
  frame: step('frame', 90, { motion: 0.03 }), still: step('still', 70, { motion: 0.02 }), stretch: step('stretch', 150, { motion: 0.12 }),
  swings: step('swings', 180, { motion: 0.5 }), kicksL: { id: 'kicksL', samples: samples(200, { motion: 0.8 }), frames: synthClip({ seconds: 14, kicks: evenKicks(5, 'left', 1, 2.4) }) } as StepData,
  kicksR: { id: 'kicksR', samples: samples(200, { motion: 0.8 }), frames: synthClip({ seconds: 14, kicks: evenKicks(5, 'right', 1, 2.4) }) } as StepData,
  out: step('out', 70, { present: false, inFrame: false, motion: 0 }), ...over,
});

describe('the guided script', () => {
  it('walks through every part, in a sensible order, in about two minutes', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['frame', 'still', 'stretch', 'swings', 'kicksL', 'kicksR', 'out']);
    const total = STEPS.reduce((a, s) => a + s.seconds, 0);
    expect(total).toBeGreaterThan(60);
    expect(total).toBeLessThan(150);
    for (const s of STEPS) { expect(s.say.length).toBeGreaterThan(10); expect(s.seconds).toBeGreaterThanOrEqual(5); }
  });
});

describe('summarize', () => {
  it('reports how often you were seen and how you moved', () => {
    const s = summarize([...samples(80, { motion: 0.4 }), ...samples(20, { present: false, inFrame: false, motion: 0 })]);
    expect(s.presentRate).toBeCloseTo(0.8, 5);
    expect(s.p25).toBeCloseTo(0.4, 5);
  });
  it('copes with no samples', () => expect(summarize([]).n).toBe(0));
});

describe('tuneKicks: fit the kick counter to how you kick', () => {
  it('keeps the standard settings when they already count correctly', () => {
    const frames = synthClip({ seconds: 14, kicks: evenKicks(5, 'left', 1, 2.4), seed: 3 });
    const r = tuneKicks(frames, { left: 5, right: 0 });
    expect(r.counted.left).toBe(5);
    expect(r.cfg.kickHeight).toBe(DEFAULT_REP_CONFIG.kickHeight);
  });
  it('relaxes the height and angle when your kicks are low and the standard settings miss them', () => {
    const frames = synthClip({ seconds: 14, kicks: evenKicks(5, 'left', 1, 2.4, { peak: 80, reach: 165 }), seed: 4 });
    const standard = tuneKicks(frames, { left: 5, right: 0 }, [DEFAULT_REP_CONFIG]);
    expect(standard.counted.left).toBeLessThan(5);
    const tuned = tuneKicks(frames, { left: 5, right: 0 });
    expect(tuned.counted.left).toBe(5);
    expect(tuned.cfg.kickHeight).toBeLessThan(DEFAULT_REP_CONFIG.kickHeight);
  });
  it('does not loosen so far that the other leg gets counted', () => {
    const frames = [...synthClip({ seconds: 14, kicks: evenKicks(5, 'left', 1, 2.4), seed: 5 })];
    const r = tuneKicks(frames, { left: 5, right: 0 });
    expect(r.counted.right).toBe(0);
  });
  it('fits both legs at once', () => {
    const L = synthClip({ seconds: 14, kicks: evenKicks(5, 'left', 1, 2.4), seed: 6 });
    const R = synthClip({ seconds: 14, kicks: evenKicks(5, 'right', 1, 2.4), seed: 7 }).map((f) => ({ ...f, t: f.t + 15000 }));
    const r = tuneKicks([...L, ...R], { left: 5, right: 5 });
    expect(r.counted).toEqual({ left: 5, right: 5 });
  });
});

describe('analyze: the report', () => {
  it('a good session is all ok, applies a movement threshold and keeps your sensitivity', () => {
    const r = analyze(good(), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.ok).toBe(true);
    expect(r.rows.every((x) => x.status === 'ok')).toBe(true);
    expect(r.settings.motionThreshold).toBeGreaterThan(0.04);
    expect(r.settings.motionThreshold).toBeLessThanOrEqual(0.3);
    expect(r.settings.quality).toBeUndefined();
    expect(r.counted).toEqual({ left: 5, right: 5 });
  });
  it('sets the movement threshold above the standing-still jitter', () => {
    const r = analyze(good({ still: step('still', 70, { motion: 0.1 }), swings: step('swings', 180, { motion: 0.6 }) }), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.settings.motionThreshold!).toBeGreaterThanOrEqual(0.2);
  });
  it('warns when your swings are barely above standing-still jitter', () => {
    const r = analyze(good({ still: step('still', 70, { motion: 0.3 }), swings: step('swings', 180, { motion: 0.35 }) }), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.rows.find((x) => x.id === 'swings')!.status).toBe('warn');
    expect(r.rows.find((x) => x.id === 'swings')!.advice).toMatch(/still|jitter|steadier|tripod|prop/i);
  });
  it('does not learn a movement threshold from a step where you were mostly not seen', () => {
    const r = analyze(good({ swings: step('swings', 180, { present: false, inFrame: false, motion: 0 }) }), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.settings.motionThreshold).toBeUndefined();
  });
  it('warns when you were not seen during a stretch', () => {
    const r = analyze(good({ stretch: step('stretch', 150, { present: false, inFrame: false }) }), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.rows.find((x) => x.id === 'stretch')!.status).toBe('warn');
    expect(r.rows.find((x) => x.id === 'stretch')!.advice).toMatch(/phone|light|farther|angle/i);
    expect(r.ok).toBe(false);
  });
  it('warns and suggests a stricter setting if it still sees someone after you left', () => {
    const r = analyze(good({ out: step('out', 70, { present: true }) }), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.rows.find((x) => x.id === 'out')!.status).toBe('warn');
    expect(r.settings.sensitivity).toBe('normal');
  });
  it('switches to the fast model when the phone is too slow', () => {
    const r = analyze(good(), { fps: 5, sensitivity: 'relaxed', quality: 'full' });
    expect(r.settings.quality).toBe('lite');
    expect(r.rows.find((x) => x.id === 'speed')!.status).toBe('warn');
  });
  it('does not touch the kick settings if too few kicks were seen to learn from', () => {
    const r = analyze(good({ kicksL: { id: 'kicksL', samples: samples(200), frames: synthClip({ seconds: 14, kicks: [] }) }, kicksR: { id: 'kicksR', samples: samples(200), frames: synthClip({ seconds: 14, kicks: [] }) } }), { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.rows.find((x) => x.id === 'kicksL')!.status).toBe('warn');
    expect(r.settings.kickCfg).toBeUndefined();
  });
  it('says plainly when nothing could be learned', () => {
    const r = analyze({}, { fps: 16, sensitivity: 'relaxed', quality: 'full' });
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/not enough|try again/i);
  });
});
