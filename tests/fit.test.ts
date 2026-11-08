import { describe, expect, it } from 'vitest';
import { fitRoutine } from '../src/engine/fit';
import { routineSeconds } from '../src/engine/plan';
import { exerciseById } from '../src/data/exercises';
import { TEMPLATES } from '../src/data/templates';

const get = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const usesGear = (r: { blocks: { exerciseId: string }[] }) => r.blocks.some((b) => exerciseById(b.exerciseId)!.equipment.length > 0);

describe('fitRoutine', () => {
  it('leaves a routine alone when it already fits', () => {
    const r = get('daily-stretch');
    const out = fitRoutine(r, 120);
    expect(out.routine.blocks).toEqual(r.blocks);
    expect(out.changed).toBe(false);
  });

  it('always fits the time given, for every template and several budgets', () => {
    for (const t of TEMPLATES) for (const m of [5, 8, 10, 15, 20, 30]) {
      const out = fitRoutine(t, m);
      expect(routineSeconds(out.routine), `${t.id} at ${m} min`).toBeLessThanOrEqual(m * 60);
      expect(out.routine.blocks.length).toBeGreaterThan(0);
    }
  });

  it('drops bands, bag and weights when short on time, but not when there is room', () => {
    const quick = fitRoutine(get('full-session'), 10);
    expect(usesGear(quick.routine)).toBe(false);
    expect(quick.dropped.length).toBeGreaterThan(0);
    const roomy = fitRoutine(get('bag-day'), 30);
    expect(usesGear(roomy.routine)).toBe(true);
  });

  it('keeps the warm-up before the work when trimming', () => {
    const out = fitRoutine(get('kick-bw'), 8);
    expect(exerciseById(out.routine.blocks[0].exerciseId)!.category).toBe('Dynamic warm-up');
  });

  it('shortens holds and reps but never below a safe floor', () => {
    const out = fitRoutine(get('daily-stretch'), 6);
    for (const b of out.routine.blocks) if (b.target.seconds !== undefined) expect(b.target.seconds).toBeGreaterThanOrEqual(10);
  });

  it('keeps the original id so the quick version still counts for the schedule', () => {
    const out = fitRoutine(get('daily-stretch'), 5);
    expect(out.routine.baseId).toBe('daily-stretch');
    expect(out.routine.name).toContain('quick');
  });

  it('does not touch the original routine', () => {
    const r = get('daily-stretch');
    const before = JSON.stringify(r);
    fitRoutine(r, 5);
    expect(JSON.stringify(r)).toBe(before);
  });

  it('with a tiny budget still returns one block rather than nothing', () => {
    const out = fitRoutine(get('daily-stretch'), 1);
    expect(out.routine.blocks.length).toBe(1);
  });
});
