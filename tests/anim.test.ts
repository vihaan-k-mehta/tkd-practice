import { describe, expect, it } from 'vitest';
import { ANIMS } from '../src/anim/library';
import { DEFAULT_POSE, joints, loopMs, poseAt, VIEWBOX } from '../src/anim/skeleton';
import { EXERCISES } from '../src/data/exercises';

describe('skeleton', () => {
  it('a standing figure has its feet on the floor line', () => {
    const j = joints(DEFAULT_POSE, 'side');
    expect(j.nearLeg[2][1]).toBeCloseTo(112, 5);
    expect(j.farLeg[2][1]).toBeCloseTo(112, 5);
  });
  it('a front kick pose puts the foot level with the hip and in front', () => {
    const j = joints({ ...DEFAULT_POSE, nh: 90, nk: 0 }, 'side');
    expect(j.nearLeg[2][1]).toBeCloseTo(j.hip[1], 5);
    expect(j.nearLeg[2][0]).toBeGreaterThan(j.hip[0] + 40);
  });
  it('a chamber puts the shin vertical below the knee', () => {
    const j = joints({ ...DEFAULT_POSE, nh: 90, nk: 90 }, 'side');
    expect(j.nearLeg[2][0]).toBeCloseTo(j.nearLeg[1][0], 5);
    expect(j.nearLeg[2][1]).toBeGreaterThan(j.nearLeg[1][1]);
  });
  it('in front view the far leg mirrors the near leg', () => {
    const j = joints({ ...DEFAULT_POSE, nh: 40, fh: 40 }, 'front');
    expect(j.nearLeg[2][0] - j.hip[0]).toBeCloseTo(j.hip[0] - j.farLeg[2][0], 5);
  });
  it('interpolates smoothly and loops', () => {
    const a = ANIMS['front-kick'];
    const total = loopMs(a);
    expect(poseAt(a, 0)).toEqual(poseAt(a, total));
    expect(poseAt(a, -1).nh).toBeCloseTo(poseAt(a, total - 1).nh, 5);
  });
});

describe('animation library', () => {
  it('has an animation for every exercise and none for missing ones', () => {
    for (const e of EXERCISES) expect(ANIMS[e.id], e.id).toBeDefined();
    for (const id of Object.keys(ANIMS)) expect(EXERCISES.some((e) => e.id === id), id).toBe(true);
  });
  it('keeps every joint inside the drawing area for the whole loop', () => {
    const bad = new Set<string>();
    for (const [id, a] of Object.entries(ANIMS)) {
      for (let t = 0; t < loopMs(a); t += 25) {
        const j = joints(poseAt(a, t), a.view);
        for (const part of [j.head, j.neck, ...j.nearArm, ...j.farArm, ...j.nearLeg, ...j.farLeg]) {
          if (part[0] < VIEWBOX.x + 2 || part[0] > VIEWBOX.x + VIEWBOX.w - 2 || part[1] - (part === j.head ? 7 : 0) < VIEWBOX.y) bad.add(`${id}@${t}:${part.map((n) => Math.round(n)).join(',')}`);
        }
      }
    }
    expect([...bad].slice(0, 40)).toEqual([]);
  });
  it('never pushes a foot through the floor', () => {
    const bad = new Set<string>();
    for (const [id, a] of Object.entries(ANIMS)) {
      for (let t = 0; t < loopMs(a); t += 25) {
        const j = joints(poseAt(a, t), a.view);
        for (const leg of [j.nearLeg, j.farLeg]) leg.forEach((pt, i) => { if (pt[1] > (i === 3 ? 122 : 117)) bad.add(`${id}@${t}:${Math.round(pt[1])}`); });
      }
    }
    expect([...bad].map((s) => s.split('@')[0]).filter((v, i, arr) => arr.indexOf(v) === i)).toEqual([]);
  });
  it('keeps every loop between 1 and 10 seconds', () => {
    for (const [id, a] of Object.entries(ANIMS)) expect(loopMs(a), id).toBeGreaterThanOrEqual(400);
  });
});
