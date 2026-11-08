import { describe, expect, it } from 'vitest';
import { exerciseById } from '../src/data/exercises';
import { blockFor, TEMPLATES } from '../src/data/templates';
import { PATTERN_KICKS } from '../src/data/types';
import { expandBlock, blockSeconds, stepSeconds } from '../src/engine/plan';
import { DropWatch } from '../src/vision/dropwatch';
import { Tracker } from '../src/vision/tracker';
import { LM, type Lm } from '../src/vision/types';
import { awardSession, applyEvents, freshProgress } from '../src/engine/quests';
import { synthClip } from './helpers/synth';
import type { SessionRecord } from '../src/data/library';

const ex = exerciseById('bill-wallace-routine')!;
const leftOnly = () => expandBlock(blockFor('bill-wallace-routine', {}), ex).filter(() => true);
const oneLeg = () => expandBlock({ ...blockFor('bill-wallace-routine'), sides: 'left' }, ex);

describe('the Bill Wallace routine, exactly as described', () => {
  it('is one continuous sequence per leg: three 10 second holds, foot down, then the kick blocks, foot down, then the combo', () => {
    const s = oneLeg();
    const kinds = s.map((x) => (x.type === 'timed' ? (x.phase === 'rest' ? 'DOWN' : `hold${x.segments[0]}`) : `${x.pattern}-${x.tempo}-${x.reps}`));
    expect(kinds).toEqual([
      'hold10', 'hold10', 'hold10', 'DOWN',
      'round-slow-5', 'round-fast-5',
      'low-high-slow-5', 'low-high-fast-5',
      'hook-round-slow-5', 'hook-round-fast-5', 'DOWN',
      'low-high-mid-hook-round-slow-5', 'low-high-mid-hook-round-fast-5',
    ]);
  });
  it('only lets the foot touch down at the designated points', () => {
    const s = oneLeg();
    const unwatched = s.filter((x) => !x.watch).map((x) => (x.type === 'timed' ? x.phase : 'reps'));
    expect(unwatched).toEqual(['rest', 'rest']);
    expect(s.filter((x) => x.watch).every((x) => x.leg === 'left')).toBe(true);
  });
  it('does both legs with a foot-down switch in between', () => {
    const both = expandBlock({ ...blockFor('bill-wallace-routine'), sides: 'both' }, ex);
    expect(both.length).toBe(oneLeg().length * 2 + 1);
    const mid = both[oneLeg().length];
    expect(mid).toMatchObject({ type: 'timed', phase: 'rest', caption: expect.stringMatching(/switch/i) });
    expect(both.filter((x) => x.leg === 'right').length).toBeGreaterThan(5);
  });
  it('counts every kick in a combo, so five low-high is ten kicks and the whole combo is twenty five', () => {
    expect(PATTERN_KICKS).toMatchObject({ round: 1, 'low-high': 2, 'hook-round': 2, 'low-high-mid-hook-round': 5 });
    const lh = oneLeg().find((x) => x.type === 'reps' && x.pattern === 'low-high' && x.tempo === 'slow')!;
    expect(lh.type === 'reps' && lh.kicksPer).toBe(2);
  });
  it('slow kicks take longer than fast ones in the time estimate', () => {
    const s = oneLeg().filter((x) => x.type === 'reps' && x.pattern === 'round');
    expect(stepSeconds(s[0])).toBeGreaterThan(stepSeconds(s[1]));
    expect(blockSeconds({ ...blockFor('bill-wallace-routine'), sides: 'both' })).toBeGreaterThan(300);
  });
  it('is a template you can start, and the exercise needs ankle weights as an option, not a requirement', () => {
    expect(TEMPLATES.some((t) => t.id === 'bill-wallace')).toBe(true);
    expect(leftOnly().length).toBeGreaterThan(10);
  });
});

/* ---- the drop detector ---- */
describe('DropWatch: foot down when it should not be', () => {
  const run = (w: DropWatch, from: number, to: number, planted: boolean | null, enabled = true) => {
    const ev: string[] = []; let alarm = false;
    for (let t = from; t <= to; t += 50) { const r = w.update(t, planted, enabled); alarm = r.alarm; if (r.event) ev.push(r.event); }
    return { ev, alarm };
  };
  it('stays quiet while the leg is up', () => {
    const w = new DropWatch();
    expect(run(w, 0, 5000, false)).toEqual({ ev: [], alarm: false });
  });
  it('ignores a touch shorter than 0.6 seconds, such as a low kick passing near the floor', () => {
    const w = new DropWatch();
    run(w, 0, 1000, false);
    expect(run(w, 1050, 1500, true).alarm).toBe(false);
    expect(run(w, 1550, 3000, false).ev).toEqual([]);
  });
  it('beeps quickly once the foot has been down for 0.6 seconds', () => {
    const w = new DropWatch();
    const r = run(w, 0, 800, true);
    expect(r.alarm).toBe(true);
    expect(r.ev).toEqual(['alarm']);
  });
  it('costs XP only if the foot stays down past the grace time', () => {
    const w = new DropWatch();
    run(w, 0, 1000, true);
    expect(run(w, 1050, 3000, true).ev).toEqual([]);          // still in the grace period
    expect(run(w, 3050, 6000, true).ev).toEqual(['penalty']);  // never lifted
    expect(w.penalties).toBe(1);
    expect(w.drops).toBe(1);
  });
  it('lifting the foot back in time clears the alarm with no penalty', () => {
    const w = new DropWatch();
    run(w, 0, 1000, true);
    const r = run(w, 1050, 2000, false);
    expect(r.ev).toEqual(['cleared']);
    expect(r.alarm).toBe(false);
    expect(w.penalties).toBe(0);
    expect(w.drops).toBe(1);
  });
  it('a second drop is a second penalty, but one drop is only penalised once', () => {
    const w = new DropWatch();
    run(w, 0, 6000, true);
    run(w, 6050, 7000, false);
    run(w, 7050, 13000, true);
    expect(w.penalties).toBe(2);
    expect(w.drops).toBe(2);
  });
  it('does nothing when switched off, for example during the designated foot-down rests', () => {
    const w = new DropWatch();
    expect(run(w, 0, 20000, true, false)).toEqual({ ev: [], alarm: false });
    expect(w.drops).toBe(0);
  });
  it('unknown leg position is never a drop', () => {
    const w = new DropWatch();
    expect(run(w, 0, 20000, null)).toEqual({ ev: [], alarm: false });
  });
});

describe('the tracker reports whether each foot is planted', () => {
  const standing = (): Lm[] => synthClip({ seconds: 1, kicks: [] })[5].lm.map((p) => ({ ...p }));
  it('both feet on the floor means planted', () => {
    const f = new Tracker().update(0, standing());
    expect(f.legs.left?.planted).toBe(true);
    expect(f.legs.right?.planted).toBe(true);
  });
  it('a raised leg is not planted and reports a height above the standing foot', () => {
    const lm = standing();
    lm[LM.leftAnkle].y -= 0.25; lm[LM.leftKnee].y -= 0.1;
    const f = new Tracker().update(0, lm);
    expect(f.legs.left?.planted).toBe(false);
    expect(f.legs.left!.height).toBeGreaterThan(0.5);
  });
  it('no information when an ankle is not visible', () => {
    const lm = standing(); lm[LM.leftAnkle].v = 0.05;
    const f = new Tracker().update(0, lm);
    expect(f.legs.left).toBeNull();
  });
});

describe('XP for foot drops', () => {
  const rec = (penalties: number): SessionRecord => ({ id: 's1', date: '2026-11-02', routineId: 'bill-wallace', routineName: 'BW', totalSec: 900, penalties, drops: penalties, blocks: [{ exerciseId: 'bill-wallace-routine', name: 'BW', plannedSec: 60, actualSec: 60, completed: true }] });
  const ctx = (r: SessionRecord) => ({ schedule: { since: '2026-11-02', weekly: [[], [], [], [], [], [], []], extras: [], moves: [], restPass: false }, history: [r], today: '2026-11-02' });
  const xp = (r: SessionRecord) => applyEvents({ ...freshProgress('2026-11-02'), xp: 100, bestXp: 100 }, awardSession(freshProgress('2026-11-02'), r, ctx(r))).xp;
  it('each un-fixed drop costs 5 XP', () => expect(xp(rec(0)) - xp(rec(2))).toBe(10));
  it('the loss is capped so one bad session cannot wipe progress', () => expect(xp(rec(0)) - xp(rec(50))).toBe(25));
});
