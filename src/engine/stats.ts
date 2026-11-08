import { exerciseById } from '../data/exercises';
import type { SessionRecord } from '../data/library';
import { addDays, weekdayOf } from './schedule';

/** Statistics from the session history. Pure. */
export const isKickExercise = (id: string): boolean => {
  const ex = exerciseById(id);
  if (!ex) return false;
  return ex.category === 'Kick technique' || (ex.category === 'Ankle weights' && id !== 'weighted-knee-raise');
};

const kicksIn = (r: SessionRecord): { left: number; right: number; any: number } => {
  let left = 0, right = 0, any = 0;
  for (const b of r.blocks) if (b.reps && isKickExercise(b.exerciseId)) { left += b.reps.left; right += b.reps.right; any += b.reps.any; }
  return { left, right, any };
};
const kickTotal = (r: SessionRecord) => { const k = kicksIn(r); return k.left + k.right + k.any; };

export function summary(h: SessionRecord[]) {
  return {
    sessions: h.length,
    minutes: Math.round(h.reduce((a, r) => a + r.totalSec, 0) / 60),
    kicks: h.reduce((a, r) => a + kickTotal(r), 0),
    drops: h.reduce((a, r) => a + (r.drops ?? 0), 0),
    penalties: h.reduce((a, r) => a + (r.penalties ?? 0), 0),
    verifiedMinutes: Math.round(h.reduce((a, r) => a + r.blocks.reduce((s, b) => s + (b.verifiedSec ?? 0), 0), 0) / 60),
  };
}

export const legSplit = (h: SessionRecord[]) => h.reduce((a, r) => { const k = kicksIn(r); return { left: a.left + k.left, right: a.right + k.right }; }, { left: 0, right: 0 });

export const weekStartOf = (d: string) => addDays(d, -weekdayOf(d));

/** The last `weeks` weeks ending with the week containing `today`, Monday first, empty weeks included. */
export function weeklyBuckets(h: SessionRecord[], today: string, weeks: number) {
  const first = addDays(weekStartOf(today), -7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(first, 7 * i), sessions: 0, minutes: 0, kicks: 0, sets: 0 }));
  for (const r of h) {
    const b = out.find((x) => x.weekStart === weekStartOf(r.date));
    if (!b) continue;
    b.sessions++; b.minutes += Math.round(r.totalSec / 60); b.kicks += kickTotal(r);
    b.sets += r.blocks.filter((x) => x.completed).reduce((a, x) => a + (x.sets ?? 0), 0);
  }
  return out;
}

export function cumulativeKicks(h: SessionRecord[]) {
  const byDate = new Map<string, number>();
  for (const r of h) byDate.set(r.date, (byDate.get(r.date) ?? 0) + kickTotal(r));
  let total = 0;
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, n]) => ({ date, total: (total += n) }));
}

/** The heaviest ankle weight used on each date for one exercise. */
export function weightSeries(h: SessionRecord[], exerciseId: string) {
  const byDate = new Map<string, number>();
  for (const r of h) for (const b of r.blocks) if (b.exerciseId === exerciseId && b.weightLb !== undefined) byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, b.weightLb));
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, lb]) => ({ date, lb }));
}

export function holdSeries(h: SessionRecord[]) {
  const byDate = new Map<string, number>();
  for (const r of h) if (r.holdPeak !== undefined) byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, r.holdPeak));
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, height]) => ({ date, height }));
}

/** Longest run of calendar days that each have at least one session. */
export function bestDayRun(h: SessionRecord[]): number {
  const days = [...new Set(h.map((r) => r.date))].sort();
  let best = 0, cur = 0, prev = '';
  for (const d of days) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}
