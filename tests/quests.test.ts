import { describe, expect, it } from 'vitest';
import { applyEvents, awardSession, beltFor, catchUp, effectiveMode, evaluate, freshProgress, quitEvents, setStrictness, startInjury, type Ctx, type Progress } from '../src/engine/quests';
import type { Schedule } from '../src/engine/schedule';
import type { SessionRecord } from '../src/data/library';

// Mon 2026-11-02 ... Sun 2026-11-08. Sessions planned Mon, Wed, Fri.
const slot = (id: string) => [{ id, routineId: 'a', time: '18:00' }];
const sched = (over: Partial<Schedule> = {}): Schedule => ({ since: '2026-11-02', weekly: [slot('m'), [], slot('w'), [], slot('f'), [], []], extras: [], moves: [], restPass: false, ...over });
const rec = (date: string, completed = 5, total = 5, routineId = 'a', id = date + routineId): SessionRecord => ({
  id, date, routineId, routineName: 'A', totalSec: 900,
  blocks: Array.from({ length: total }, (_, i) => ({ exerciseId: 'x', name: 'x', plannedSec: 60, actualSec: 60, completed: i < completed })),
});
const ctx = (today: string, history: SessionRecord[] = [], s: Schedule = sched()): Ctx => ({ schedule: s, history, today });
const prog = (over: Partial<Progress> = {}): Progress => ({ ...freshProgress('2026-11-02'), mode: 'light', chosen: true, xp: 200, bestXp: 200, ...over });
const sum = (ev: { type: string; delta?: number }[]) => ev.reduce((a, e) => a + (e.type === 'xp' ? e.delta ?? 0 : 0), 0);

describe('evaluate: a missed day', () => {
  it('does nothing until the day is over', () => {
    expect(evaluate('2026-11-02', prog(), ctx('2026-11-02'))).toEqual([]);
  });
  it('light: the day quest is forfeited, no XP is lost, no make-up round', () => {
    const ev = evaluate('2026-11-02', prog(), ctx('2026-11-03'));
    expect(ev.map((e) => e.type)).toContain('forfeit');
    expect(sum(ev)).toBe(0);
    expect(ev.map((e) => e.type)).not.toContain('makeup');
  });
  it('strict: lose 50 XP and add a make-up round', () => {
    const ev = evaluate('2026-11-02', prog({ mode: 'strict' }), ctx('2026-11-03'));
    expect(sum(ev)).toBe(-50);
    expect(ev.map((e) => e.type)).toContain('makeup');
  });
  it('off: nothing happens', () => {
    expect(evaluate('2026-11-02', prog({ mode: 'off' }), ctx('2026-11-03'))).toEqual([]);
  });
  it('a completed day has no penalty', () => {
    expect(evaluate('2026-11-02', prog({ mode: 'strict' }), ctx('2026-11-03', [rec('2026-11-02')]))).toEqual([]);
  });
  it('a rest day has no penalty', () => {
    expect(evaluate('2026-11-03', prog({ mode: 'strict' }), ctx('2026-11-04'))).toEqual([]);
  });
});

describe('evaluate: a day crossing midnight', () => {
  it('a session logged just after midnight counts for the new day, so the old day is missed', () => {
    const history = [rec('2026-11-03')]; // finished at 00:30 on Tuesday, planned for Monday
    const ev = evaluate('2026-11-02', prog({ mode: 'strict' }), ctx('2026-11-03', history));
    expect(sum(ev)).toBe(-50);
  });
  it('the new day is not judged while it is still in progress', () => {
    expect(evaluate('2026-11-04', prog({ mode: 'strict' }), ctx('2026-11-04'))).toEqual([]);
  });
});

describe('evaluate: rest pass', () => {
  const s = sched({ restPass: true });
  it('forgives the first miss of the week', () => {
    const ev = evaluate('2026-11-02', prog({ mode: 'strict' }), ctx('2026-11-03', [], s));
    expect(ev.map((e) => e.type)).toEqual(['passUsed']);
  });
  it('does not forgive a second miss in the same week', () => {
    let st = prog({ mode: 'strict' });
    st = applyEvents(st, evaluate('2026-11-02', st, ctx('2026-11-05', [], s)));
    const ev = evaluate('2026-11-04', st, ctx('2026-11-05', [], s));
    expect(sum(ev)).toBe(-50);
  });
  it('is available again next week', () => {
    let st = prog({ mode: 'strict' });
    st = applyEvents(st, evaluate('2026-11-02', st, ctx('2026-11-12', [], s)));
    const s2 = sched({ restPass: true });
    const ev = evaluate('2026-11-09', st, ctx('2026-11-12', [], s2));
    expect(ev.map((e) => e.type)).toEqual(['passUsed']);
  });
});

describe('injury mode', () => {
  it('pauses consequences for the set days and asks Bill Wallace to restart one level lower', () => {
    let st = prog({ mode: 'strict' });
    st = applyEvents(st, startInjury(st, 7, '2026-11-02'));
    expect(st.bwDrops).toBe(1);
    expect(evaluate('2026-11-04', st, ctx('2026-11-05'))).toEqual([]);
  });
  it('consequences return after the injury days end', () => {
    let st = prog({ mode: 'strict' });
    st = applyEvents(st, startInjury(st, 2, '2026-11-02'));
    expect(sum(evaluate('2026-11-04', st, ctx('2026-11-05')))).toBe(-50);
  });
});

describe('strictness changes', () => {
  it('a change made mid-week only takes effect next Monday', () => {
    const st = setStrictness(prog({ mode: 'strict' }), 'off', '2026-11-04'); // Wednesday
    expect(effectiveMode(st, '2026-11-06')).toBe('strict');
    expect(effectiveMode(st, '2026-11-08')).toBe('strict');
    expect(effectiveMode(st, '2026-11-09')).toBe('off');
  });
  it('a miss before that Monday still gets the old penalty', () => {
    const st = setStrictness(prog({ mode: 'strict' }), 'off', '2026-11-04');
    expect(sum(evaluate('2026-11-06', st, ctx('2026-11-07')))).toBe(-50);
  });
  it('the very first choice applies immediately', () => {
    const st = setStrictness({ ...prog(), chosen: false }, 'strict', '2026-11-04');
    expect(effectiveMode(st, '2026-11-04')).toBe('strict');
  });
});

describe('weekly quest and weekly consequences', () => {
  it('awards the weekly quest when enough sessions are done', () => {
    const history = [rec('2026-11-02'), rec('2026-11-04'), rec('2026-11-06')];
    const ev = evaluate('2026-11-08', prog(), ctx('2026-11-09', history));
    expect(ev.some((e) => e.type === 'xp' && e.reason === 'Weekly quest')).toBe(true);
  });
  it('two misses fail the weekly quest, and strict also locks the Bill Wallace weight', () => {
    const history = [rec('2026-11-06')];
    const light = evaluate('2026-11-08', prog(), ctx('2026-11-09', history));
    expect(light.map((e) => e.type)).toContain('weekFail');
    expect(light.map((e) => e.type)).not.toContain('bwLock');
    expect(light.some((e) => e.type === 'xp' && e.reason === 'Weekly quest')).toBe(false);
    const strict = evaluate('2026-11-08', prog({ mode: 'strict' }), ctx('2026-11-09', history));
    expect(strict.map((e) => e.type)).toContain('bwLock');
  });
  it('with a rest pass, two misses count as one and the week does not fail', () => {
    const ev = evaluate('2026-11-08', prog(), ctx('2026-11-09', [rec('2026-11-06')], sched({ restPass: true })));
    expect(ev.map((e) => e.type)).not.toContain('weekFail');
  });
});

describe('catchUp', () => {
  it('judges each missed day once, and running it again changes nothing', () => {
    const c = ctx('2026-11-06');
    const first = catchUp(prog({ mode: 'strict', processedThrough: '' }), c);
    expect(first.state.xp).toBe(200 - 100); // Mon and Wed missed
    expect(first.state.makeUp).toBe(2);
    const second = catchUp(first.state, c);
    expect(second.events).toEqual([]);
    expect(second.state).toEqual(first.state);
  });
  it('never takes XP below zero', () => {
    const r = catchUp(prog({ mode: 'strict', xp: 30, processedThrough: '' }), ctx('2026-11-06'));
    expect(r.state.xp).toBe(0);
  });
  it('does not demote the belt when XP is lost', () => {
    const r = catchUp(prog({ mode: 'strict', xp: 120, bestXp: 120, processedThrough: '' }), ctx('2026-11-06'));
    expect(beltFor(r.state.bestXp).belt.id).toBe('yellow');
  });
});

describe('awardSession', () => {
  it('gives block XP and the daily quest bonus once the day is finished', () => {
    const r = rec('2026-11-02');
    const ev = awardSession(prog(), r, ctx('2026-11-02', [r]));
    expect(ev.some((e) => e.reason === 'Daily quest')).toBe(true);
    expect(sum(ev)).toBe(20 + 10 + 20);
  });
  it('gives nothing extra for an unfinished session', () => {
    const r = rec('2026-11-02', 2, 5);
    const ev = awardSession(prog(), r, ctx('2026-11-02', [r]));
    expect(ev.some((e) => e.reason === 'Daily quest')).toBe(false);
    expect(sum(ev)).toBe(8);
  });
  it('extra practice only earns a bonus once the daily session is done', () => {
    const first = rec('2026-11-02', 5, 5, 'b', 'x1');
    const early = awardSession(prog(), first, ctx('2026-11-02', [first]));
    expect(early.some((e) => e.reason === 'Extra practice')).toBe(false);
    const daily = rec('2026-11-02');
    const extra = rec('2026-11-02', 5, 5, 'b', 'x2');
    const later = awardSession(prog(), extra, ctx('2026-11-02', [daily, extra]));
    expect(later.some((e) => e.reason === 'Extra practice')).toBe(true);
  });
  it('extra practice on a rest day earns the bonus', () => {
    const r = rec('2026-11-03', 5, 5, 'b');
    expect(awardSession(prog(), r, ctx('2026-11-03', [r])).some((e) => e.reason === 'Extra practice')).toBe(true);
  });
  it('awarding the same session twice does not double the XP', () => {
    const r = rec('2026-11-02');
    const c = ctx('2026-11-02', [r]);
    let st = prog();
    st = applyEvents(st, awardSession(st, r, c));
    const again = applyEvents(st, awardSession(st, r, c));
    expect(again.xp).toBe(st.xp);
  });
  it('finishing a session clears a pending make-up round', () => {
    const r = rec('2026-11-02');
    const st = applyEvents(prog({ makeUp: 2 }), awardSession(prog({ makeUp: 2 }), r, ctx('2026-11-02', [r])));
    expect(st.makeUp).toBe(0);
  });
});

describe('honor mode', () => {
  it('an unverified session earns half XP and a verified one earns full', () => {
    const r = rec('2026-11-02');
    const full = sum(awardSession(prog(), r, ctx('2026-11-02', [r])));
    const u = { ...r, unverified: true };
    const half = sum(awardSession(prog(), u, ctx('2026-11-02', [u])));
    expect(half).toBe(Math.floor(20 / 2) + Math.floor(10 / 2) + Math.floor(20 / 2));
    expect(half).toBeLessThan(full);
  });
});

describe('quitting', () => {
  it('strict forfeits the day quest, light only leaves unfinished blocks uncounted', () => {
    expect(quitEvents(prog({ mode: 'strict' }), '2026-11-02', ctx('2026-11-02')).map((e) => e.type)).toContain('forfeit');
    expect(quitEvents(prog({ mode: 'light' }), '2026-11-02', ctx('2026-11-02'))).toEqual([]);
  });
  it('a forfeited day pays no daily quest bonus even if finished later', () => {
    let st = prog({ mode: 'strict' });
    st = applyEvents(st, quitEvents(st, '2026-11-02', ctx('2026-11-02')));
    const r = rec('2026-11-02');
    expect(awardSession(st, r, ctx('2026-11-02', [r])).some((e) => e.reason === 'Daily quest')).toBe(false);
  });
});

describe('belts', () => {
  it('each belt needs more XP than the last', () => {
    const xp = [0, 100, 250, 450, 700, 1000].map((x) => beltFor(x).belt.id);
    expect(xp).toEqual(['white', 'yellow', 'green', 'blue', 'red', 'black']);
  });
  it('reports progress to the next belt', () => {
    const b = beltFor(175);
    expect(b.belt.id).toBe('yellow');
    expect(b.next?.id).toBe('green');
    expect(b.fraction).toBeCloseTo(0.5, 5);
  });
  it('black belt has no next', () => expect(beltFor(5000).next).toBeUndefined());
});
