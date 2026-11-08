import { describe, expect, it } from 'vitest';
import { Tracker } from '../src/vision/tracker';
import { bodyInFrame } from '../src/vision/framing';
import { angle, torsoLength } from '../src/vision/geometry';
import { OneEuro } from '../src/vision/filters';
import { Gate } from '../src/vision/gate';
import { LM, type Lm } from '../src/vision/types';
import { evenKicks, synthClip } from './helpers/synth';

const run = (clip: { t: number; lm: Lm[] }[]) => {
  const tr = new Tracker();
  let last = tr.update(0, null);
  for (const f of clip) last = tr.update(f.t, f.lm);
  return last.reps;
};
const within = (got: number, want: number) => Math.abs(got - want) <= Math.max(0, Math.floor(want / 10));

describe('geometry and filters', () => {
  it('measures angles', () => {
    expect(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180, 5);
    expect(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
  });
  it('torso length is shoulder-mid to hip-mid', () => {
    const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 1 }));
    lm[LM.leftShoulder] = { x: 0.4, y: 0.3, v: 1 }; lm[LM.rightShoulder] = { x: 0.6, y: 0.3, v: 1 };
    lm[LM.leftHip] = { x: 0.45, y: 0.6, v: 1 }; lm[LM.rightHip] = { x: 0.55, y: 0.6, v: 1 };
    expect(torsoLength(lm)).toBeCloseTo(0.3, 5);
  });
  it('One Euro filter smooths noise but follows real movement', () => {
    const f = new OneEuro();
    const steady = Array.from({ length: 30 }, (_, i) => f.filter(0.5 + (i % 2 ? 0.01 : -0.01), i * 66));
    expect(Math.abs(steady[29] - 0.5)).toBeLessThan(0.006);
    const g = new OneEuro();
    let v = 0; for (let i = 0; i < 20; i++) v = g.filter(i < 5 ? 0 : 1, i * 66);
    expect(v).toBeGreaterThan(0.9);
  });
});

describe('rep counter on synthetic clips (guide target: within 1 rep per 10)', () => {
  it('clip 1: 10 left kicks', () => {
    const r = run(synthClip({ seconds: 25, kicks: evenKicks(10, 'left') }));
    expect(within(r.left, 10)).toBe(true);
    expect(r.right).toBe(0);
  });
  it('clip 2: 8 right kicks, small and far from the camera, noisy', () => {
    const r = run(synthClip({ seconds: 22, kicks: evenKicks(8, 'right'), torso: 0.12, noise: 0.003, seed: 7 }));
    expect(within(r.right, 8)).toBe(true);
    expect(r.left).toBe(0);
  });
  it('clip 3: 5 left then 5 right', () => {
    const r = run(synthClip({ seconds: 25, kicks: [...evenKicks(5, 'left', 1, 2), ...evenKicks(5, 'right', 12, 2)], seed: 3 }));
    expect(within(r.left, 5)).toBe(true);
    expect(within(r.right, 5)).toBe(true);
  });
  it('clip 4: fast Bill Wallace style kicks, 10 in 12 seconds, with bouncing and lost ankle frames', () => {
    const r = run(synthClip({ seconds: 14, kicks: evenKicks(10, 'left', 0.5, 1.25, { dur: 0.95 }), bounce: 0.02, jitterDrop: 0.03, seed: 11 }));
    expect(within(r.left, 10)).toBe(true);
  });
  it('clip 5: close to the camera, high kicks, off-centre', () => {
    const r = run(synthClip({ seconds: 20, kicks: evenKicks(7, 'right', 1, 2.4, { peak: 115 }), torso: 0.3, cx: 0.35, seed: 5 }));
    expect(within(r.right, 7)).toBe(true);
  });
  it('does not count standing still', () => {
    expect(run(synthClip({ seconds: 20, kicks: [] }))).toEqual({ left: 0, right: 0 });
  });
  it('does not count knee raises where the leg never straightens', () => {
    const r = run(synthClip({ seconds: 16, kicks: evenKicks(6, 'left', 1, 2, { reach: 115 }) }));
    expect(r.left).toBe(0);
  });
  it('does not count a low half-kick that never reaches the minimum height', () => {
    const r = run(synthClip({ seconds: 16, kicks: evenKicks(6, 'left', 1, 2, { peak: 50 }) }));
    expect(r.left).toBe(0);
  });
  it('a kick is counted once, at the return, never twice', () => {
    const r = run(synthClip({ seconds: 5, kicks: [{ at: 1, leg: 'left' }] }));
    expect(r.left).toBe(1);
  });
  it('ignores frames where the leg is not visible', () => {
    const clip = synthClip({ seconds: 8, kicks: [{ at: 1, leg: 'left' }, { at: 4, leg: 'left' }] });
    const tr = new Tracker();
    for (const f of clip) { const lm = f.lm.map((p) => ({ ...p })); if (f.t > 2500 && f.t < 3500) { lm[LM.leftAnkle].v = 0.1; lm[LM.leftKnee].v = 0.1; } tr.update(f.t, lm); }
    expect(tr.reps.left).toBe(2);
  });
});

describe('framing', () => {
  const full = (): Lm[] => synthClip({ seconds: 1, kicks: [] })[5].lm.map((p) => ({ ...p }));
  it('accepts a body that is fully visible', () => expect(bodyInFrame(full()).ok).toBe(true));
  it('asks you to step back when the legs are cut off', () => {
    const lm = full(); lm[LM.leftAnkle].y = 1.05; lm[LM.rightAnkle].y = 1.05;
    const r = bodyInFrame(lm);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/step back/i);
  });
  it('reports nobody in view', () => {
    expect(bodyInFrame(null).ok).toBe(false);
    expect(bodyInFrame(null).message).toMatch(/step back|whole body/i);
  });
  it('rejects low confidence', () => {
    const lm = full(); lm[LM.leftKnee].v = 0.2;
    expect(bodyInFrame(lm).ok).toBe(false);
  });
});

describe('gate: pauses and resumes the timer', () => {
  const step = (g: Gate, from: number, to: number, input: { person: boolean; moving: boolean }, dt = 100) => { let r = g.state; for (let t = from; t <= to; t += dt) r = g.update(t, input); return r; };

  it('runs while a person is detected', () => {
    const g = new Gate('presence');
    const r = step(g, 0, 3000, { person: true, moving: false });
    expect(r.state).toBe('verified');
    expect(r.running).toBe(true);
    expect(r.verifiedMs).toBeGreaterThan(2800);
  });
  it('tolerates a short dropout, then pauses with a message after 1 second', () => {
    const g = new Gate('presence');
    step(g, 0, 2000, { person: true, moving: false });
    expect(step(g, 2100, 2800, { person: false, moving: false }).running).toBe(true);
    const r = step(g, 2900, 3500, { person: false, moving: false });
    expect(r.state).toBe('searching');
    expect(r.running).toBe(false);
    expect(r.message).toMatch(/step back/i);
  });
  it('resumes only after being detected for 0.5 seconds', () => {
    const g = new Gate('presence');
    step(g, 0, 1000, { person: true, moving: false });
    step(g, 1100, 3000, { person: false, moving: false });
    expect(step(g, 3100, 3400, { person: true, moving: false }).running).toBe(false);
    const r = step(g, 3500, 3800, { person: true, moving: false });
    expect(r.running).toBe(true);
    expect(r.state).toBe('verified');
  });
  it('verified time stops while paused', () => {
    const g = new Gate('presence');
    step(g, 0, 2000, { person: true, moving: false });
    const before = g.state.verifiedMs;
    step(g, 2100, 8000, { person: false, moving: false });
    expect(g.state.verifiedMs - before).toBeLessThan(1300);
  });
  it('motion mode goes idle after 5 seconds without movement and resumes when moving', () => {
    const g = new Gate('motion');
    step(g, 0, 2000, { person: true, moving: true });
    expect(step(g, 2100, 6500, { person: true, moving: false }).running).toBe(true);
    const idle = step(g, 6600, 8000, { person: true, moving: false });
    expect(idle.state).toBe('idle');
    expect(idle.message).toMatch(/keep moving/i);
    const back = step(g, 8100, 8800, { person: true, moving: true });
    expect(back.running).toBe(true);
  });
  it('presence mode never goes idle for standing still', () => {
    const g = new Gate('presence');
    expect(step(g, 0, 20000, { person: true, moving: false }).state).toBe('verified');
  });
  it('fails the block after more than 60 seconds paused in total', () => {
    const g = new Gate('presence');
    step(g, 0, 1000, { person: true, moving: false });
    const r = step(g, 1100, 70000, { person: false, moving: false }, 500);
    expect(r.state).toBe('failed');
    expect(r.running).toBe(false);
    expect(step(g, 70500, 72000, { person: true, moving: true }).state).toBe('failed');
  });
  it('counts pauses across the block, not just the last one', () => {
    const g = new Gate('presence');
    let t = 0;
    for (let i = 0; i < 4; i++) { step(g, t, t + 2000, { person: true, moving: false }); t += 2100; step(g, t, t + 17000, { person: false, moving: false }, 500); t += 17500; }
    expect(g.state.state).toBe('failed');
  });
});
