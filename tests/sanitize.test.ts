import { describe, expect, it } from 'vitest';
import { cleanRoutines, cleanSchedule } from '../src/data/sanitize';
import { emptySchedule } from '../src/engine/schedule';

describe('cleanRoutines', () => {
  it('drops non-arrays, bad ids and unknown exercises', () => {
    expect(cleanRoutines('x')).toEqual([]);
    const out = cleanRoutines([
      { id: '<script>', name: 'bad', blocks: [] },
      { id: 'ok', name: 'Good', blocks: [{ exerciseId: 'hamstring', target: { seconds: 30 } }, { exerciseId: 'nope', target: {} }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].blocks).toHaveLength(1);
  });
  it('trims names, strips control characters and clamps numbers', () => {
    const [r] = cleanRoutines([{ id: 'a', name: `  ${'x'.repeat(200)}\u0007 `, blocks: [{ exerciseId: 'hamstring', target: { seconds: 9e9, reps: -5 } }] }]);
    expect(r.name.length).toBe(60);
    expect(r.name).not.toMatch(/[\u0000-\u001f]/);
    expect(r.blocks[0].target.seconds).toBe(3600);
    expect(r.blocks[0].target.reps).toBe(1);
  });
  it('keeps markup as plain text, never as HTML (Preact escapes it on render)', () => {
    const [r] = cleanRoutines([{ id: 'a', name: '<img src=x onerror=alert(1)>', blocks: [] }]);
    expect(r.name).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('cleanSchedule', () => {
  const fb = emptySchedule('2026-11-02');
  it('falls back on garbage', () => expect(cleanSchedule(42, fb)).toBe(fb));
  it('rejects bad times, dates and ids', () => {
    const s = cleanSchedule({ since: 'nope', weekly: [[{ id: 'a', routineId: 'r', time: '25:99' }, { id: 'b', routineId: 'r', time: '07:30' }]], extras: [{ id: 'c', routineId: 'r', time: '07:30', date: 'x' }], moves: [{ slotId: 'b', from: '2026-11-02', to: '2026-11-03' }, { slotId: '"><', from: '2026-11-02', to: '' }] }, fb);
    expect(s.since).toBe('2026-11-02');
    expect(s.weekly[0].map((z) => z.id)).toEqual(['b']);
    expect(s.weekly).toHaveLength(7);
    expect(s.extras).toEqual([]);
    expect(s.moves).toHaveLength(1);
  });
});
