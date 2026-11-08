import { exerciseById } from '../data/exercises';
import type { Block, Exercise, Routine, Sides, Target } from '../data/types';

export const READY_SEC = 5;
export const SEC_PER_REP = 3; // planning estimate for reps blocks

export type Step =
  | { type: 'timed'; phase: 'work' | 'rest'; segments: number[]; sideLabels?: string[]; caption?: string }
  | { type: 'reps'; reps: number; side?: string; caption?: string };

const sideList = (s?: Sides): string[] | undefined =>
  s === 'both' ? ['Left side', 'Right side'] : s === 'left' ? ['Left side'] : s === 'right' ? ['Right side'] : undefined;

/** Turns one block into the ordered steps the runner walks through. Pure. */
export function expandBlock(block: Block, ex: Exercise): Step[] {
  const t = block.target;
  const sides = sideList(block.sides);
  const steps: Step[] = [];

  if (ex.blockType === 'hold') {
    const sec = t.seconds ?? 30;
    steps.push({ type: 'timed', phase: 'work', segments: sides ? sides.map(() => sec) : [sec], sideLabels: sides });
  } else if (ex.blockType === 'rest') {
    steps.push({ type: 'timed', phase: 'rest', segments: [t.seconds ?? 30] });
  } else if (ex.blockType === 'rounds') {
    const rounds = t.rounds ?? 1;
    for (let r = 1; r <= rounds; r++) {
      steps.push({ type: 'timed', phase: 'work', segments: [t.workSec ?? 60], caption: `Round ${r} of ${rounds}` });
      if (r < rounds && (t.restSec ?? 0) > 0) steps.push({ type: 'timed', phase: 'rest', segments: [t.restSec!], caption: `Rest before round ${r + 1}` });
    }
  } else {
    const sets = t.rounds ?? 1;
    for (let s = 1; s <= sets; s++) {
      const caption = sets > 1 ? `Set ${s} of ${sets}` : undefined;
      if (sides) sides.forEach((side) => steps.push({ type: 'reps', reps: t.reps ?? 10, side, caption }));
      else steps.push({ type: 'reps', reps: t.reps ?? 10, caption });
      if (s < sets && (t.restSec ?? 0) > 0) steps.push({ type: 'timed', phase: 'rest', segments: [t.restSec!], caption: `Rest before set ${s + 1}` });
    }
  }
  return steps;
}

export const stepSeconds = (s: Step): number => (s.type === 'timed' ? s.segments.reduce((a, b) => a + b, 0) : s.reps * SEC_PER_REP);

export function blockSeconds(block: Block): number {
  const ex = exerciseById(block.exerciseId);
  if (!ex) return 0;
  return READY_SEC + expandBlock(block, ex).reduce((a, s) => a + stepSeconds(s), 0);
}
export const routineSeconds = (r: Routine): number => r.blocks.reduce((a, bl) => a + blockSeconds(bl), 0);
export const routineMinutes = (r: Routine): number => Math.max(1, Math.round(routineSeconds(r) / 60));

/** Indexes of stretching blocks that have no dynamic warm-up before them. */
export function warmupReminderIndexes(r: Routine): Set<number> {
  const out = new Set<number>();
  let warmed = false;
  r.blocks.forEach((bl, i) => {
    const cat = exerciseById(bl.exerciseId)?.category;
    if (cat === 'Dynamic warm-up') warmed = true;
    if (cat === 'Stretching' && !warmed) out.add(i);
  });
  return out;
}

export function targetSummary(block: Block, ex: Exercise): string {
  const t: Target = block.target;
  const per = block.sides === 'both' ? ' per side' : block.sides ? ` ${block.sides} only` : '';
  const sec = (n?: number) => (n && n >= 60 && n % 60 === 0 ? `${n / 60} min` : `${n ?? 0} s`);
  switch (ex.blockType) {
    case 'hold': return `${sec(t.seconds)}${per}`;
    case 'rest': return sec(t.seconds);
    case 'rounds': return `${t.rounds ?? 1} rounds, ${sec(t.workSec)} on, ${sec(t.restSec)} off`;
    default: return `${(t.rounds ?? 1) > 1 ? `${t.rounds} sets of ` : ''}${t.reps ?? 10} reps${per}${(t.rounds ?? 1) > 1 ? `, ${sec(t.restSec)} rest` : ''}`;
  }
}

export const equipmentNeeded = (r: Routine) =>
  [...new Set(r.blocks.flatMap((bl) => exerciseById(bl.exerciseId)?.equipment ?? []))];
