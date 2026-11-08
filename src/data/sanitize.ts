import { exerciseById } from './exercises';
import type { Block, Routine, Sides, Target } from './types';
import type { Schedule, Slot } from '../engine/schedule';

/** Saved data can be edited by hand or by another script on the same origin, so check it on load. */
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
const ID = /^[A-Za-z0-9_-]{1,60}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cleanTarget(t: unknown): Target {
  const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
  const out: Target = {};
  const s = num(o.seconds, 1, 3600), r = num(o.reps, 1, 500), n = num(o.rounds, 1, 50), w = num(o.workSec, 1, 3600), x = num(o.restSec, 0, 3600);
  if (s !== undefined) out.seconds = s; if (r !== undefined) out.reps = r; if (n !== undefined) out.rounds = n;
  if (w !== undefined) out.workSec = w; if (x !== undefined) out.restSec = x;
  return out;
}

export function cleanRoutines(v: unknown): Routine[] {
  if (!Array.isArray(v)) return [];
  const out: Routine[] = [];
  for (const r of v.slice(0, 200)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || !ID.test(o.id)) continue;
    const blocks: Block[] = [];
    for (const b of (Array.isArray(o.blocks) ? o.blocks : []).slice(0, 100)) {
      const bo = (b ?? {}) as Record<string, unknown>;
      if (typeof bo.exerciseId !== 'string' || !exerciseById(bo.exerciseId)) continue;
      const sides: Sides | undefined = bo.sides === 'both' || bo.sides === 'left' || bo.sides === 'right' ? bo.sides : undefined;
      blocks.push({ exerciseId: bo.exerciseId, target: cleanTarget(bo.target), sides });
    }
    out.push({ id: o.id, name: text(o.name, 60) || 'My routine', blocks, baseId: typeof o.baseId === 'string' && ID.test(o.baseId) ? o.baseId : undefined });
  }
  return out;
}

export function cleanSchedule(v: unknown, fallback: Schedule): Schedule {
  if (!v || typeof v !== 'object') return fallback;
  const o = v as Record<string, unknown>;
  const slot = (z: unknown): Slot | null => {
    const s = (z ?? {}) as Record<string, unknown>;
    return typeof s.id === 'string' && ID.test(s.id) && typeof s.routineId === 'string' && ID.test(s.routineId) && typeof s.time === 'string' && TIME.test(s.time)
      ? { id: s.id, routineId: s.routineId, time: s.time } : null;
  };
  const weekly = Array.from({ length: 7 }, (_, i) => ((Array.isArray(o.weekly) && Array.isArray(o.weekly[i]) ? o.weekly[i] : []) as unknown[]).slice(0, 20).map(slot).filter((x): x is Slot => !!x));
  const extras = (Array.isArray(o.extras) ? o.extras : []).slice(0, 500).flatMap((e) => {
    const s = (e ?? {}) as Record<string, unknown>;
    const z = slot(s);
    return z && typeof s.date === 'string' && DATE.test(s.date) ? [{ ...z, date: s.date }] : [];
  });
  const moves = (Array.isArray(o.moves) ? o.moves : []).slice(0, 500).flatMap((m) => {
    const s = (m ?? {}) as Record<string, unknown>;
    return typeof s.slotId === 'string' && ID.test(s.slotId) && typeof s.from === 'string' && DATE.test(s.from) && typeof s.to === 'string' && (s.to === '' || DATE.test(s.to))
      ? [{ slotId: s.slotId, from: s.from, to: s.to }] : [];
  });
  return { since: typeof o.since === 'string' && DATE.test(o.since) ? o.since : fallback.since, weekly, extras, moves, restPass: o.restPass === true };
}
