import { describe, expect, it } from 'vitest';
import { addDays, dayState, monthGrid, occurrences, streak, toIcs, weekdayOf, type Schedule } from '../src/engine/schedule';
import type { SessionRecord } from '../src/data/library';

const rec = (date: string, routineId = 'a'): SessionRecord => ({ id: date + routineId, date, routineId, routineName: routineId, totalSec: 600, blocks: [] });
// 2026-11-02 is a Monday.
const base: Schedule = { since: '2026-11-02', weekly: [[{ id: 's1', routineId: 'a', time: '18:00' }], [], [{ id: 's2', routineId: 'a', time: '18:00' }], [], [{ id: 's3', routineId: 'a', time: '18:00' }], [], []], extras: [], moves: [], restPass: false };

describe('dates', () => {
  it('computes weekday with Monday = 0', () => {
    expect(weekdayOf('2026-11-02')).toBe(0);
    expect(weekdayOf('2026-11-08')).toBe(6);
  });
  it('adds days across months', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('occurrences', () => {
  it('lists weekly sessions for the weekday', () => {
    expect(occurrences(base, '2026-11-02').map((o) => o.slotId)).toEqual(['s1']);
    expect(occurrences(base, '2026-11-03')).toEqual([]);
  });
  it('ignores dates before the schedule began', () => {
    expect(occurrences(base, '2026-10-26')).toEqual([]);
  });
  it('adds one-offs and honours moves', () => {
    const s: Schedule = { ...base, extras: [{ id: 'x', date: '2026-11-03', routineId: 'b', time: '07:00' }], moves: [{ slotId: 's1', from: '2026-11-02', to: '2026-11-04' }] };
    expect(occurrences(s, '2026-11-02')).toEqual([]);
    expect(occurrences(s, '2026-11-03').map((o) => o.routineId)).toEqual(['b']);
    expect(occurrences(s, '2026-11-04').map((o) => o.slotId).sort()).toEqual(['s1', 's2']);
  });
  it('sorts by time', () => {
    const s: Schedule = { ...base, extras: [{ id: 'x', date: '2026-11-02', routineId: 'b', time: '07:00' }] };
    expect(occurrences(s, '2026-11-02').map((o) => o.time)).toEqual(['07:00', '18:00']);
  });
});

describe('dayState', () => {
  const today = '2026-11-05';
  it('rest when nothing is planned', () => expect(dayState(base, [], '2026-11-03', today)).toBe('rest'));
  it('planned for the future', () => expect(dayState(base, [], '2026-11-06', today)).toBe('planned'));
  it('done when the routine was logged that day', () => expect(dayState(base, [rec('2026-11-02')], '2026-11-02', today)).toBe('done'));
  it('missed when a past session was not logged', () => expect(dayState(base, [], '2026-11-02', today)).toBe('missed'));
  it('partly done when only some sessions were logged', () => {
    const s: Schedule = { ...base, extras: [{ id: 'x', date: '2026-11-02', routineId: 'b', time: '07:00' }] };
    expect(dayState(s, [rec('2026-11-02', 'a')], '2026-11-02', today)).toBe('partial');
  });
  it('one logged session cannot satisfy two slots of the same routine', () => {
    const s: Schedule = { ...base, extras: [{ id: 'x', date: '2026-11-02', routineId: 'a', time: '07:00' }] };
    expect(dayState(s, [rec('2026-11-02', 'a')], '2026-11-02', today)).toBe('partial');
  });
  it('today that is not finished is planned, not missed', () => expect(dayState(base, [], '2026-11-04', '2026-11-04')).toBe('planned'));
  it('days before the schedule began are rest, never missed', () => expect(dayState(base, [], '2026-10-26', today)).toBe('rest'));
});

describe('streak', () => {
  it('counts consecutive scheduled days and ignores rest days', () => {
    const h = [rec('2026-11-02'), rec('2026-11-04'), rec('2026-11-06')];
    expect(streak(base, h, '2026-11-07')).toBe(3);
  });
  it('a miss breaks it', () => {
    const h = [rec('2026-11-02'), rec('2026-11-06')];
    expect(streak(base, h, '2026-11-07')).toBe(1);
  });
  it('an unfinished today does not break it', () => {
    const h = [rec('2026-11-02'), rec('2026-11-04')];
    expect(streak(base, h, '2026-11-06')).toBe(2);
  });
  it('finishing today adds to it', () => {
    const h = [rec('2026-11-02'), rec('2026-11-04'), rec('2026-11-06')];
    expect(streak(base, h, '2026-11-06')).toBe(3);
  });
  it('one rest pass per week forgives a single miss', () => {
    const s = { ...base, restPass: true };
    const h = [rec('2026-11-02'), rec('2026-11-06')];
    expect(streak(s, h, '2026-11-07')).toBe(2);
  });
  it('the rest pass forgives only one miss per week', () => {
    const s = { ...base, restPass: true };
    expect(streak(s, [rec('2026-11-06')], '2026-11-07')).toBe(1);
  });
  it('is zero with nothing scheduled', () => {
    expect(streak({ ...base, weekly: [[], [], [], [], [], [], []] }, [], '2026-11-07')).toBe(0);
  });
});

describe('monthGrid', () => {
  it('starts on Monday and covers whole weeks', () => {
    const g = monthGrid(2026, 10); // November 2026
    expect(g[0]).toBe('2026-10-26');
    expect(g.length % 7).toBe(0);
    expect(g).toContain('2026-11-30');
  });
});

describe('toIcs', () => {
  const ics = toIcs(base, (id) => (id === 'a' ? 'Kick day' : id), '2026-11-02');
  it('has one weekly event per slot with an alarm', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=WE');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('SUMMARY:Kick day');
  });
  it('uses floating local times and CRLF line endings', () => {
    expect(ics).toContain('DTSTART:20261102T180000');
    expect(ics).not.toMatch(/DTSTART[^\r]*Z/);
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
  });
});

import { availFor, availLabel, timeInWindow, type Avail } from '../src/engine/schedule';

describe('availability', () => {
  it('describes a window in plain words', () => {
    expect(availLabel({ from: '17:00' })).toBe('After 5 pm');
    expect(availLabel({ until: '08:00' })).toBe('Before 8 am');
    expect(availLabel({ from: '17:30', until: '20:00' })).toBe('5:30 pm to 8 pm');
    expect(availLabel({ from: '17:00', minutes: 30 })).toBe('After 5 pm, 30 min');
    expect(availLabel({ minutes: 20 })).toBe('20 min');
    expect(availLabel({})).toBe('Free all day');
    expect(availLabel({ from: '00:00' })).toBe('After 12 am');
    expect(availLabel({ from: '12:00' })).toBe('After 12 pm');
  });
  it('checks whether a time fits the window', () => {
    const a: Avail = { from: '17:00', until: '20:00' };
    expect(timeInWindow('18:30', a)).toBe(true);
    expect(timeInWindow('16:59', a)).toBe(false);
    expect(timeInWindow('20:01', a)).toBe(false);
    expect(timeInWindow('09:00', {})).toBe(true);
  });
  it('reads a weekday safely when the plan has no availability yet', () => {
    expect(availFor(base, 0)).toEqual({});
    expect(availFor({ ...base, avail: [{ minutes: 15 }, {}, {}, {}, {}, {}, {}] }, 0)).toEqual({ minutes: 15 });
  });
});
