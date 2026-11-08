import { exerciseById } from '../data/exercises';
import type { Block, Routine, Target } from '../data/types';
import { routineSeconds } from './plan';

export interface Fit { routine: Routine; changed: boolean; dropped: string[]; scaled: boolean; seconds: number }

/** Higher means keep it longer when time is short. */
const PRIORITY: Record<string, number> = {
  'Dynamic warm-up': 5, 'Kick technique': 4, 'Ankle weights': 3, 'Stretching': 3, 'Shadow sparring': 3, 'Heavy bag': 2,
  'Resistance bands': 2, 'Plyometrics': 2, 'Sparring formats': 2, 'Cool-down': 1,
};
const prio = (b: Block) => PRIORITY[exerciseById(b.exerciseId)?.category ?? ''] ?? 2;
const needsGear = (b: Block) => (exerciseById(b.exerciseId)?.equipment.length ?? 0) > 0 || !!exerciseById(b.exerciseId)?.needsPartner;

const FLOOR = { seconds: 10, reps: 4, rounds: 1, workSec: 30, restSec: 15 };
function scaleTarget(t: Target, f: number): Target {
  const sc = (v: number | undefined, floor: number) => (v === undefined ? undefined : Math.max(Math.min(v, floor), Math.round(v * f)));
  const rest = (v: number | undefined) => (v === undefined || v === 0 ? v : Math.max(Math.min(v, FLOOR.restSec), Math.round(v * f)));
  const out: Target = { ...t };
  if (t.seconds !== undefined) out.seconds = sc(t.seconds, FLOOR.seconds);
  if (t.reps !== undefined) out.reps = sc(t.reps, FLOOR.reps);
  if (t.rounds !== undefined) out.rounds = sc(t.rounds, FLOOR.rounds);
  if (t.workSec !== undefined) out.workSec = sc(t.workSec, FLOOR.workSec);
  if (t.restSec !== undefined) out.restSec = rest(t.restSec);
  return out;
}

const build = (r: Routine, blocks: Block[]): Routine => ({ ...r, id: `${r.baseId ?? r.id}-quick`, baseId: r.baseId ?? r.id, name: `${r.name.replace(/ \(quick\)$/, '')} (quick)`, template: false, blocks });

/**
 * Adapts a routine to the minutes someone really has.
 * Under 15 minutes it drops anything needing gear or a partner, then shortens everything,
 * then drops the least important blocks from the end. Pure; the original is untouched.
 */
export function fitRoutine(routine: Routine, minutes: number): Fit {
  const budget = Math.max(1, minutes) * 60;
  const original = routineSeconds(routine);
  if (original <= budget) return { routine, changed: false, dropped: [], scaled: false, seconds: original };

  let blocks = routine.blocks.map((b) => ({ ...b, target: { ...b.target } }));
  const dropped: string[] = [];
  const drop = (i: number) => { dropped.push(exerciseById(blocks[i].exerciseId)?.name ?? blocks[i].exerciseId); blocks = blocks.filter((_, j) => j !== i); };

  if (minutes < 15) {
    const bodyweight = blocks.filter((b) => !needsGear(b));
    if (bodyweight.length > 0) {
      blocks.filter(needsGear).forEach((b) => dropped.push(exerciseById(b.exerciseId)?.name ?? b.exerciseId));
      blocks = bodyweight;
    }
  }

  const size = (bs: Block[], f: number) => routineSeconds({ ...routine, blocks: bs.map((b) => ({ ...b, target: scaleTarget(b.target, f) })) });
  const factors = [1, 0.85, 0.7, 0.55, 0.4];
  for (;;) {
    const f = factors.find((x) => size(blocks, x) <= budget);
    if (f !== undefined) {
      const scaled = f < 1;
      const out = build(routine, blocks.map((b) => ({ ...b, target: scaleTarget(b.target, f) })));
      return { routine: out, changed: true, dropped, scaled, seconds: routineSeconds(out) };
    }
    if (blocks.length <= 1) {
      const out = build(routine, blocks.map((b) => ({ ...b, target: scaleTarget(b.target, 0.4) })));
      return { routine: out, changed: true, dropped, scaled: true, seconds: routineSeconds(out) };
    }
    // Drop the lowest priority block, the latest one among ties.
    let worst = 0;
    blocks.forEach((b, i) => { if (prio(b) <= prio(blocks[worst])) worst = i; });
    drop(worst);
  }
}
