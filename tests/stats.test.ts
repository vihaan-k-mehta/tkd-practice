import { describe, expect, it } from 'vitest';
import { bestDayRun, cumulativeKicks, summary, weeklyBuckets, weightSeries, holdSeries, legSplit } from '../src/engine/stats';
import { progressWeights, WEIGHT_STEP } from '../src/engine/progression';
import { applyEvents, freshProgress, type Progress } from '../src/engine/quests';
import type { SessionRecord } from '../src/data/library';

type B = SessionRecord['blocks'][number];
const blk = (exerciseId: string, over: Partial<B> = {}): B => ({ exerciseId, name: exerciseId, plannedSec: 60, actualSec: 60, completed: true, ...over });
const rec = (date: string, blocks: B[], over: Partial<SessionRecord> = {}): SessionRecord =>
  ({ id: date + Math.random().toString(36).slice(2, 6), date, routineId: 'r', routineName: 'R', totalSec: 600, blocks, ...over });
const kick = (l: number, r: number, over: Partial<B> = {}) => blk('bill-wallace-routine', { reps: { left: l, right: r, any: 0 }, ...over });

describe('stats summary', () => {
  const h = [
    rec('2026-11-02', [kick(20, 18, { weightLb: 1 }), blk('hamstring')], { totalSec: 1200 }),
    rec('2026-11-04', [kick(25, 25, { weightLb: 1.5 })], { totalSec: 900, drops: 2, penalties: 1, holdPeak: 1.1 }),
    rec('2026-11-05', [blk('hamstring')], { totalSec: 300 }),
  ];
  it('totals sessions, minutes and kicks, counting only kick exercises', () => {
    const s = summary(h);
    expect(s.sessions).toBe(3);
    expect(s.minutes).toBe(40);
    expect(s.kicks).toBe(88);
    expect(s.drops).toBe(2);
    expect(s.penalties).toBe(1);
  });
  it('ignores reps from stretches and warm-ups when counting kicks', () => {
    const s = summary([rec('2026-11-02', [blk('leg-swing-front', { reps: { left: 12, right: 12, any: 0 } })])]);
    expect(s.kicks).toBe(0);
  });
  it('splits kicks by leg', () => expect(legSplit(h)).toEqual({ left: 45, right: 43 }));
  it('handles no history', () => expect(summary([])).toMatchObject({ sessions: 0, minutes: 0, kicks: 0 }));
});

describe('series for the graphs', () => {
  const h = [
    rec('2026-10-27', [kick(10, 10)]),            // Monday of the previous week
    rec('2026-11-02', [kick(20, 20, { weightLb: 1 })], { holdPeak: 1.0 }),
    rec('2026-11-03', [kick(5, 5, { weightLb: 1 })]),
    rec('2026-11-09', [kick(30, 30, { weightLb: 1.5 })], { holdPeak: 1.2 }),
  ];
  it('buckets by week starting Monday, filling empty weeks with zeros', () => {
    const w = weeklyBuckets(h, '2026-11-12', 4);
    expect(w.map((x) => x.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
    expect(w.map((x) => x.sessions)).toEqual([0, 1, 2, 1]);
    expect(w.map((x) => x.kicks)).toEqual([0, 20, 50, 60]);
  });
  it('cumulative kicks only ever go up and end at the total', () => {
    const c = cumulativeKicks(h);
    expect(c.map((p) => p.total)).toEqual([20, 60, 70, 130]);
    expect(c[c.length - 1].total).toBe(summary(h).kicks);
  });
  it('weight over time keeps one point per date at the highest weight used', () => {
    expect(weightSeries(h, 'bill-wallace-routine')).toEqual([{ date: '2026-11-02', lb: 1 }, { date: '2026-11-03', lb: 1 }, { date: '2026-11-09', lb: 1.5 }]);
  });
  it('hold height over time', () => expect(holdSeries(h)).toEqual([{ date: '2026-11-02', height: 1 }, { date: '2026-11-09', height: 1.2 }]));
  it('best run of days in a row', () => {
    expect(bestDayRun(h)).toBe(2);
    expect(bestDayRun([])).toBe(0);
  });
});

describe('ankle weight progression', () => {
  const prog = (over: Partial<Progress> = {}): Progress => ({ ...freshProgress('2026-11-02'), ...over });
  const clean = (date: string) => rec(date, [kick(25, 25, { weightLb: 1 })]);
  const dirty = (date: string) => rec(date, [kick(25, 25, { weightLb: 1 })], { penalties: 1, drops: 1 });
  const run = (p: Progress, r: SessionRecord, ctx: { today: string; thisWeek?: string } = { today: '2026-11-05' }) => applyEvents(p, progressWeights(p, r, ctx));

  it('does not go up after one clean session, but does after two in a row', () => {
    let p = prog({ weights: { 'bill-wallace-routine': 1 } });
    p = run(p, clean('2026-11-02'));
    expect(p.weights['bill-wallace-routine']).toBe(1);
    p = run(p, clean('2026-11-03'));
    expect(p.weights['bill-wallace-routine']).toBe(1 + WEIGHT_STEP);
    expect(p.cleanStreak['bill-wallace-routine'] ?? 0).toBe(0);
  });
  it('a session with an unfixed foot drop resets the streak', () => {
    let p = prog({ weights: { 'bill-wallace-routine': 1 } });
    p = run(p, clean('2026-11-02'));
    p = run(p, dirty('2026-11-03'));
    p = run(p, clean('2026-11-04'));
    expect(p.weights['bill-wallace-routine']).toBe(1);
  });
  it('an unfinished block is not clean', () => {
    let p = prog({ weights: { 'bill-wallace-routine': 1 } });
    const r = rec('2026-11-02', [kick(25, 25, { weightLb: 1, completed: false })]);
    p = run(p, r); p = run(p, r);
    expect(p.weights['bill-wallace-routine']).toBe(1);
  });
  it('is held back in a week the weight is locked (strict mode, two misses)', () => {
    let p = prog({ weights: { 'bill-wallace-routine': 1 }, bwLocked: ['2026-11-02'] });
    p = run(p, clean('2026-11-03')); p = run(p, clean('2026-11-04'));
    expect(p.weights['bill-wallace-routine']).toBe(1);
  });
  it('after an injury it restarts one level lower, once', () => {
    let p = prog({ weights: { 'bill-wallace-routine': 2 }, bwDrops: 1 });
    p = run(p, clean('2026-11-10'));
    expect(p.weights['bill-wallace-routine']).toBe(2 - WEIGHT_STEP);
    expect(p.bwDrops).toBe(0);
    p = run(p, clean('2026-11-11'));
    expect(p.weights['bill-wallace-routine']).toBe(2 - WEIGHT_STEP);
  });
  it('never goes below zero', () => {
    let p = prog({ weights: { 'bill-wallace-routine': 0 }, bwDrops: 1 });
    p = run(p, clean('2026-11-10'));
    expect(p.weights['bill-wallace-routine']).toBe(0);
  });
  it('works for other ankle-weight exercises too, and ignores exercises without weights', () => {
    let p = prog({ weights: { 'weighted-slow-kicks': 1 } });
    const r = rec('2026-11-02', [blk('weighted-slow-kicks', { weightLb: 1, reps: { left: 10, right: 10, any: 0 } }), blk('hamstring')]);
    p = run(p, r); p = run(p, r);
    expect(p.weights['weighted-slow-kicks']).toBe(1.5);
    expect(p.weights['hamstring']).toBeUndefined();
  });
});
