import { describe, expect, it } from 'vitest';
import { packFrame, sampleFromBuffer, type Packed } from '../src/vision/samples';
import { analyzeExport } from '../src/vision/analyze';
import { evenKicks, synthClip } from './helpers/synth';

describe('sampleFromBuffer: turn the last minute of tracking into a recording', () => {
  const buf: Packed[] = synthClip({ seconds: 90, kicks: evenKicks(5, 'left', 70, 3), seed: 3 }).map((f) => packFrame(f.t, f.lm));
  const end = buf[buf.length - 1][0];
  it('keeps only the last N seconds and starts the clock at zero', () => {
    const s = sampleFromBuffer(buf, { exerciseId: 'roundhouse', leg: 'left', expected: 5, seconds: 40, now: end, id: 'x', fps: 15 });
    expect(s.frames[0][0]).toBe(0);
    expect(s.frames[s.frames.length - 1][0]).toBeLessThanOrEqual(40000);
    expect(s.frames[s.frames.length - 1][0]).toBeGreaterThan(38000);
    expect(s.frames.length).toBeLessThan(buf.length);
  });
  it('never makes a recording longer than the limit that fits in the cloud table', () => {
    const s = sampleFromBuffer(buf, { exerciseId: 'roundhouse', leg: 'left', expected: 5, seconds: 600, now: end, id: 'x', fps: 15 });
    expect(JSON.stringify(s.frames).length).toBeLessThan(380_000);
    expect(s.frames[s.frames.length - 1][0]).toBeLessThanOrEqual(60000);
  });
  it('clamps silly rep counts', () => {
    expect(sampleFromBuffer(buf, { exerciseId: 'a', leg: 'both', expected: 9999, seconds: 10, now: end, id: 'x', fps: 15 }).expected).toBe(100);
    expect(sampleFromBuffer(buf, { exerciseId: 'a', leg: 'both', expected: -4, seconds: 10, now: end, id: 'x', fps: 15 }).expected).toBe(0);
  });
});

describe('analyzeExport: the report I can run on a file you send me', () => {
  const take = (exerciseId: string, leg: 'left' | 'right', opts: Parameters<typeof evenKicks>[4] = {}, seed = 1) => ({
    id: exerciseId + leg, exerciseId, leg, expected: 5, fps: 15, createdAt: 1,
    frames: synthClip({ seconds: 20, kicks: evenKicks(5, leg, 1, 3, opts), seed }).map((f) => packFrame(f.t, f.lm)),
  });
  const file = { app: 'tkd-practice', version: 1, samples: [take('roundhouse', 'left'), take('roundhouse', 'right', {}, 2), take('front-kick', 'left', { peak: 80, reach: 165 }, 3), take('side-kick', 'left', { peak: 80, reach: 165 }, 4)] };
  it('reports each exercise with the standard count and the tuned count', () => {
    const r = analyzeExport(file);
    const rh = r.rows.find((x) => x.exerciseId === 'roundhouse')!;
    expect(rh.samples).toBe(2);
    expect(rh.before).toBe('10/10');
    expect(rh.after).toBe('10/10');
    const fk = r.rows.find((x) => x.exerciseId === 'front-kick')!;
    expect(Number(fk.before.split('/')[0])).toBeLessThan(5);
    expect(fk.after).toBe('5/5');
  });
  it('suggests defaults that would help everyone when several exercises need the same loosening', () => {
    const r = analyzeExport(file);
    expect(r.suggestedDefaults).toBeDefined();
    expect(r.suggestedDefaults!.kickHeight!).toBeLessThan(-0.2);
  });
  it('copes with an empty or broken file', () => {
    expect(analyzeExport({} as never).rows).toEqual([]);
    expect(analyzeExport({ samples: [{ id: 1 }] } as never).rows).toEqual([]);
  });
});
