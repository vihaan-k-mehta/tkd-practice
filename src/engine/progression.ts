import { exerciseById } from '../data/exercises';
import type { SessionRecord } from '../data/library';
import type { Event, Progress } from './quests';
import { weekStartOf } from './stats';

export const WEIGHT_STEP = 0.5; // pounds
export const CLEAN_SESSIONS_TO_ADVANCE = 2;
const BW = ['bill-wallace-routine', 'bill-wallace'];

/**
 * Ankle weight progression. Two clean sessions in a row at a weight earns the next half pound.
 * "Clean" means the block was finished, nothing hurt, no foot drop went unfixed, and the camera was watching.
 * A locked week holds the Bill Wallace weight, and an injury restarts it one level lower, once.
 */
export function progressWeights(p: Progress, r: SessionRecord, _ctx: { today: string }): Event[] {
  const out: Event[] = [];
  let dropUsed = false;
  for (const b of r.blocks) {
    const ex = exerciseById(b.exerciseId);
    if (!ex || !ex.equipment.includes('ankleWeights')) continue;
    const cur = p.weights[b.exerciseId] ?? b.weightLb ?? 0;

    if (p.bwDrops > 0 && !dropUsed && BW.includes(b.exerciseId)) {
      dropUsed = true;
      out.push({ type: 'bwDropUsed', date: r.date });
      out.push({ type: 'weight', exerciseId: b.exerciseId, lb: Math.max(0, cur - WEIGHT_STEP), reason: 'Restarted one level lower after injury', date: r.date });
      out.push({ type: 'clean', exerciseId: b.exerciseId, streak: 0, date: r.date });
      continue;
    }
    if (r.unverified) continue; // cannot confirm it was clean without the camera
    const clean = b.completed && !b.hurt && (r.penalties ?? 0) === 0;
    if (!clean) { out.push({ type: 'clean', exerciseId: b.exerciseId, streak: 0, date: r.date }); continue; }
    if (BW.includes(b.exerciseId) && p.bwLocked.includes(weekStartOf(r.date))) continue; // held this week
    const streak = (p.cleanStreak[b.exerciseId] ?? 0) + 1;
    if (streak >= CLEAN_SESSIONS_TO_ADVANCE) {
      out.push({ type: 'weight', exerciseId: b.exerciseId, lb: cur + WEIGHT_STEP, reason: `Two clean sessions at ${cur} lb`, date: r.date });
      out.push({ type: 'clean', exerciseId: b.exerciseId, streak: 0, date: r.date });
    } else out.push({ type: 'clean', exerciseId: b.exerciseId, streak, date: r.date });
  }
  return out;
}
