import { describe, it, expect } from 'vitest';
import { EXERCISES, exerciseById } from '../src/data/exercises';
import { TEMPLATES, blockFor } from '../src/data/templates';
import { expandBlock, blockSeconds, routineMinutes, warmupReminderIndexes, equipmentNeeded, READY_SEC } from '../src/engine/plan';

const steps = (id: string, over = {}) => expandBlock(blockFor(id, over), exerciseById(id)!);

describe('expandBlock', () => {
  it('two-sided hold becomes one timed step with two segments and side labels', () => {
    expect(steps('hamstring', { seconds: 30 })).toEqual([
      { type: 'timed', phase: 'work', segments: [30, 30], sideLabels: ['Left side', 'Right side'] },
    ]);
  });

  it('hold without sides is a single segment', () => {
    const s = steps('butterfly');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ segments: [45] });
  });

  it('rounds alternate work and rest and end on work', () => {
    const s = steps('bag-roundhouse', { rounds: 3, workSec: 180, restSec: 60 });
    expect(s.map((x) => (x.type === 'timed' ? x.phase : 'reps'))).toEqual(['work', 'rest', 'work', 'rest', 'work']);
    expect(s[0]).toMatchObject({ caption: 'Round 1 of 3' });
  });

  it('reps with sets: left, right, rest, left, right, rest, left, right', () => {
    const s = steps('bill-wallace');
    expect(s.map((x) => (x.type === 'reps' ? x.side![0] : 'R'))).toEqual(['L', 'R', 'R', 'L', 'R', 'R', 'L', 'R']);
    expect(s.filter((x) => x.type === 'reps')).toHaveLength(6);
    expect(s[0]).toMatchObject({ type: 'reps', reps: 10, caption: 'Set 1 of 3' });
  });

  it('a single set has no rest and no set caption', () => {
    const s = steps('bill-wallace', { rounds: 1 });
    expect(s.map((x) => x.type)).toEqual(['reps', 'reps']);
    expect((s[0] as { caption?: string }).caption).toBeUndefined();
  });

  it('rest block is a plain countdown', () => {
    const rest = { id: 'r', name: 'Rest', category: 'x', equipment: [], blockType: 'rest', defaultTarget: { seconds: 20 }, cues: [], verify: 'none' } as const;
    expect(expandBlock({ exerciseId: 'r', target: { seconds: 20 } }, rest as never)).toEqual([{ type: 'timed', phase: 'rest', segments: [20] }]);
  });

  it('one side only', () => {
    const b = { ...blockFor('hamstring'), sides: 'left' as const };
    expect(expandBlock(b, exerciseById('hamstring')!)[0]).toMatchObject({ segments: [40], sideLabels: ['Left side'] });
  });
});

describe('timing', () => {
  it('block seconds include the 5 s get-ready', () => {
    expect(blockSeconds(blockFor('butterfly'))).toBe(READY_SEC + 45);
    expect(blockSeconds(blockFor('hamstring', { seconds: 30 }))).toBe(READY_SEC + 60);
  });
  it('rounds time is work plus rests', () => {
    expect(blockSeconds(blockFor('bag-roundhouse', { rounds: 3, workSec: 180, restSec: 60 }))).toBe(READY_SEC + 3 * 180 + 2 * 60);
  });
  it('daily stretch is roughly a quarter of an hour or less', () => {
    const m = routineMinutes(TEMPLATES.find((t) => t.id === 'daily-stretch')!);
    expect(m).toBeGreaterThanOrEqual(10);
    expect(m).toBeLessThanOrEqual(18);
  });
});

describe('library and templates', () => {
  it('exercise ids are unique and every exercise has 2 to 4 cues', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) { expect(e.cues.length).toBeGreaterThanOrEqual(1); expect(e.cues.length).toBeLessThanOrEqual(4); }
  });
  it('every template block references a real exercise and expands to steps', () => {
    for (const t of TEMPLATES) for (const bl of t.blocks) {
      const ex = exerciseById(bl.exerciseId);
      expect(ex, `${t.id}:${bl.exerciseId}`).toBeTruthy();
      expect(expandBlock(bl, ex!).length).toBeGreaterThan(0);
    }
  });
  it('ships the six templates', () => {
    expect(TEMPLATES.map((t) => t.name)).toEqual(['Daily stretch', 'Kick day with Bill Wallace', 'Bag day', 'Plyo and legs', 'Shadow sparring', 'Full session']);
  });
  it('partner-only sparring formats are flagged', () => {
    expect(exerciseById('spar-point')!.needsPartner).toBe(true);
    expect(exerciseById('spar-continuous')!.needsPartner).toBeFalsy();
  });
  it('Bill Wallace is camera rep-counted', () => {
    expect(exerciseById('bill-wallace')!.verify).toBe('reps');
  });
});

describe('safety reminder', () => {
  it('flags stretching with no warm-up before it', () => {
    const r = { id: 'x', name: 'x', blocks: [blockFor('hamstring'), blockFor('butterfly')] };
    expect([...warmupReminderIndexes(r)]).toEqual([0, 1]);
  });
  it('does not flag stretching after a dynamic warm-up', () => {
    const r = { id: 'x', name: 'x', blocks: [blockFor('leg-swing-front'), blockFor('hamstring')] };
    expect(warmupReminderIndexes(r).size).toBe(0);
  });
  it('daily stretch template starts with a warm-up so no reminders', () => {
    expect(warmupReminderIndexes(TEMPLATES.find((t) => t.id === 'daily-stretch')!).size).toBe(0);
  });
});

describe('equipment', () => {
  it('lists what a routine needs', () => {
    const r = { id: 'x', name: 'x', blocks: [blockFor('bag-roundhouse'), blockFor('jump-rope'), blockFor('butterfly')] };
    expect(equipmentNeeded(r).sort()).toEqual(['heavyBag', 'rope']);
  });
});

describe('camera coverage', () => {
  it('every exercise is camera-checked in some way, so the detail screen never says it is unchecked', async () => {
    const { EXERCISES } = await import('../src/data/exercises');
    expect(EXERCISES.filter((e) => e.verify === 'none').map((e) => e.id)).toEqual([]);
  });
  it('leg swings, knee raises and hip circles check that you are moving', async () => {
    const { exerciseById } = await import('../src/data/exercises');
    for (const id of ['leg-swing-front', 'leg-swing-side', 'hip-circles', 'knee-raises']) expect(exerciseById(id)!.verify, id).toBe('motion');
  });
});
