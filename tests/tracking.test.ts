import { describe, expect, it } from 'vitest';
import { personPresent } from '../src/vision/framing';
import { Gate } from '../src/vision/gate';
import { learnFromSamples, PROFILES, profileFor } from '../src/vision/profiles';
import { LM, type Lm } from '../src/vision/types';
import { synthClip } from './helpers/synth';

const standing = (): Lm[] => synthClip({ seconds: 1, kicks: [] })[5].lm.map((p) => ({ ...p }));
const hide = (lm: Lm[], ...idx: number[]) => { idx.forEach((i) => { lm[i].v = 0.05; }); return lm; };

describe('personPresent: a person, not a full body', () => {
  it('sees a standing person', () => expect(personPresent(standing(), 0.35)).toBe(true));
  it('still sees you with both ankles and knees hidden (floor work, close to the phone)', () => {
    expect(personPresent(hide(standing(), LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle), 0.35)).toBe(true);
  });
  it('still sees you with one whole leg hidden', () => {
    expect(personPresent(hide(standing(), LM.leftKnee, LM.leftAnkle), 0.35)).toBe(true);
  });
  it('still sees you partly outside the frame', () => {
    const lm = standing(); lm[LM.leftAnkle].y = 1.2; lm[LM.rightAnkle].y = 1.2;
    expect(personPresent(lm, 0.35)).toBe(true);
  });
  it('does not see nobody', () => {
    expect(personPresent(null, 0.35)).toBe(false);
    const empty: Lm[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
    expect(personPresent(empty, 0.35)).toBe(false);
  });
  it('does not call a lone hand a person', () => {
    const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0 }));
    lm[LM.leftWrist].v = 0.9;
    expect(personPresent(lm, 0.35)).toBe(false);
  });
});

describe('sensitivity profiles', () => {
  const step = (g: Gate, from: number, to: number, person: boolean, moving = true) => { let r = g.state; for (let t = from; t <= to; t += 100) r = g.update(t, { person, moving }); return r; };
  it('relaxed rides out a two second dropout, strict (the guide values) does not', () => {
    const relaxed = new Gate('presence', PROFILES.relaxed.gate);
    step(relaxed, 0, 2000, true);
    expect(step(relaxed, 2100, 4000, false).running).toBe(true);

    const strict = new Gate('presence', PROFILES.strict.gate);
    step(strict, 0, 2000, true);
    expect(step(strict, 2100, 4000, false).running).toBe(false);
  });
  it('relaxed resumes faster after you come back', () => {
    const g = new Gate('presence', PROFILES.relaxed.gate);
    step(g, 0, 1000, true);
    step(g, 1100, 6000, false);
    expect(g.state.running).toBe(false);
    expect(step(g, 6100, 6500, true).running).toBe(true);
  });
  it('relaxed waits much longer before calling you idle in motion mode', () => {
    const r = new Gate('motion', PROFILES.relaxed.gate);
    step(r, 0, 2000, true, true);
    expect(step(r, 2100, 9000, true, false).running).toBe(true);
    const s = new Gate('motion', PROFILES.strict.gate);
    step(s, 0, 2000, true, true);
    expect(step(s, 2100, 9000, true, false).running).toBe(false);
  });
  it('relaxed still fails a block that was out of view for far too long', () => {
    const g = new Gate('presence', PROFILES.relaxed.gate);
    step(g, 0, 1000, true);
    expect(step(g, 1100, 200000, false).state).toBe('failed');
  });
  it('a learned movement threshold overrides the profile', () => {
    expect(profileFor('relaxed', 0.07).moving).toBe(0.07);
    expect(profileFor('relaxed', undefined).moving).toBe(PROFILES.relaxed.moving);
  });
  it('the guide values are what strict means', () => {
    expect(PROFILES.strict.minVis).toBe(0.5);
    expect(PROFILES.strict.gate).toMatchObject({ searchAfter: 1000, resumeAfter: 500, idleAfter: 5000 });
  });
});

describe('learnFromSamples: training from your own setup', () => {
  const frames = (n: number, present: boolean, motion: number) => Array.from({ length: n }, () => ({ present, motion }));
  it('sets the movement threshold from how you actually move, not a fixed number', () => {
    const slow = learnFromSamples([...frames(80, true, 0.12), ...frames(20, true, 0.2)]);
    const fast = learnFromSamples([...frames(80, true, 0.6), ...frames(20, true, 0.9)]);
    expect(slow.moveThreshold).toBeLessThan(fast.moveThreshold);
    expect(slow.moveThreshold).toBeGreaterThanOrEqual(0.04);
    expect(fast.moveThreshold).toBeLessThanOrEqual(0.3);
    expect(slow.ok).toBe(true);
  });
  it('reports how often you were seen', () => {
    const r = learnFromSamples([...frames(90, true, 0.2), ...frames(10, false, 0)]);
    expect(r.presentRate).toBeCloseTo(0.9, 5);
  });
  it('says it could not see you when you were mostly missing, and does not change anything', () => {
    const r = learnFromSamples([...frames(20, true, 0.2), ...frames(80, false, 0)]);
    expect(r.ok).toBe(false);
    expect(r.advice).toMatch(/phone|light|farther|step back/i);
  });
  it('handles nothing at all', () => {
    expect(learnFromSamples([]).ok).toBe(false);
  });
});
