import { exerciseById } from './exercises';
import type { Block, Routine, Sides, Target } from './types';
import type { Schedule, Slot } from '../engine/schedule';
import type { Mode, Progress } from '../engine/quests';

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
  const avail = Array.from({ length: 7 }, (_, i) => {
    const a = ((Array.isArray(o.avail) ? o.avail[i] : undefined) ?? {}) as Record<string, unknown>;
    const out: { from?: string; until?: string; minutes?: number } = {};
    if (typeof a.from === 'string' && TIME.test(a.from)) out.from = a.from;
    if (typeof a.until === 'string' && TIME.test(a.until)) out.until = a.until;
    const m = num(a.minutes, 1, 480); if (m !== undefined) out.minutes = m;
    return out;
  });
  return { since: typeof o.since === 'string' && DATE.test(o.since) ? o.since : fallback.since, weekly, extras, moves, restPass: o.restPass === true, avail };
}

const strs = (v: unknown, max: number, re: RegExp): string[] => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && re.test(x)).slice(-max);
export function cleanProgress(v: unknown, fallback: Progress): Progress {
  if (!v || typeof v !== 'object') return fallback;
  const o = v as Record<string, unknown>;
  const mode = (m: unknown): Mode | undefined => (m === 'off' || m === 'light' || m === 'strict' ? m : undefined);
  const pend = (o.pending ?? {}) as Record<string, unknown>;
  const xp = num(o.xp, 0, 1_000_000) ?? 0;
  return {
    ...fallback, xp, bestXp: Math.max(xp, num(o.bestXp, 0, 1_000_000) ?? 0),
    mode: mode(o.mode) ?? fallback.mode, chosen: o.chosen === true,
    pending: mode(pend.mode) && typeof pend.from === 'string' && DATE.test(pend.from) ? { mode: pend.mode as Mode, from: pend.from } : undefined,
    processedThrough: typeof o.processedThrough === 'string' && (o.processedThrough === '' || DATE.test(o.processedThrough)) ? o.processedThrough : '',
    passUsed: strs(o.passUsed, 200, DATE), weekFailed: strs(o.weekFailed, 200, DATE), bwLocked: strs(o.bwLocked, 200, DATE), forfeited: strs(o.forfeited, 800, DATE),
    awarded: strs(o.awarded, 2000, /^[A-Za-z0-9:_-]{1,90}$/),
    injuryUntil: typeof o.injuryUntil === 'string' && DATE.test(o.injuryUntil) ? o.injuryUntil : undefined,
    bwDrops: num(o.bwDrops, 0, 100) ?? 0, makeUp: num(o.makeUp, 0, 3) ?? 0,
    weights: numMap(o.weights, 0, 50), cleanStreak: numMap(o.cleanStreak, 0, 50),
    goals: (Array.isArray(o.goals) ? o.goals : []).slice(0, 50).flatMap((g) => {
      const x = (g ?? {}) as Record<string, unknown>;
      const title = text(x.title, 60);
      return typeof x.id === 'string' && ID.test(x.id) && title ? [{ id: x.id, title, done: x.done === true }] : [];
    }),
    log: (Array.isArray(o.log) ? o.log : []).slice(0, 40).flatMap((l) => {
      const x = (l ?? {}) as Record<string, unknown>;
      return typeof x.date === 'string' && DATE.test(x.date) ? [{ date: x.date, text: text(x.text, 120) }] : [];
    }),
  };
}

/** A small map of exercise id to a clamped number. */
function numMap(v: unknown, lo: number, hi: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 100)) {
      if (ID.test(k) && typeof x === 'number' && Number.isFinite(x)) out[k] = Math.max(lo, Math.min(hi, x));
    }
  }
  return out;
}

import type { CameraSettings } from './library';
import type { Equipment } from './types';

export const DEFAULT_CAMERA: CameraSettings = { use: true, honor: false, skeleton: false, sensitivity: 'relaxed', quality: 'full', exercise: {} };
const NUM = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);

export function cleanCamera(v: unknown, d: CameraSettings = DEFAULT_CAMERA): CameraSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const kc = (o.kickCfg && typeof o.kickCfg === 'object' ? o.kickCfg : {}) as Record<string, unknown>;
  const kickCfg = { kickHeight: NUM(kc.kickHeight, -1, 1), extendAngle: NUM(kc.extendAngle, 100, 175), chamberAngle: NUM(kc.chamberAngle, 40, 140), returnAngle: NUM(kc.returnAngle, 60, 170) };
  const exercise: CameraSettings['exercise'] = {};
  if (o.exercise && typeof o.exercise === 'object') {
    for (const [id, raw] of Object.entries(o.exercise as Record<string, unknown>).slice(0, 80)) {
      if (!ID.test(id) || !raw || typeof raw !== 'object') continue;
      const x = raw as Record<string, unknown>;
      const k = (x.kickCfg && typeof x.kickCfg === 'object' ? x.kickCfg : {}) as Record<string, unknown>;
      const kcx = { kickHeight: NUM(k.kickHeight, -1, 1), extendAngle: NUM(k.extendAngle, 100, 175), chamberAngle: NUM(k.chamberAngle, 40, 140), returnAngle: NUM(k.returnAngle, 60, 170) };
      exercise[id] = { motionThreshold: NUM(x.motionThreshold, 0.02, 0.5), kickCfg: Object.values(kcx).some((q) => q !== undefined) ? kcx : undefined, samples: NUM(x.samples, 0, 100) ?? 0 };
    }
  }
  return {
    use: o.use !== false, honor: o.honor === true, skeleton: o.skeleton === true,
    kickHeight: NUM(o.kickHeight, -1, 1),
    sensitivity: o.sensitivity === 'normal' || o.sensitivity === 'strict' || o.sensitivity === 'relaxed' ? o.sensitivity : d.sensitivity,
    quality: o.quality === 'lite' ? 'lite' : 'full',
    motionThreshold: NUM(o.motionThreshold, 0.02, 0.5),
    kickCfg: Object.values(kickCfg).some((x) => x !== undefined) ? kickCfg : undefined,
    exercise,
  };
}

export function cleanEquipment(v: unknown): Record<Equipment, boolean> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { ankleWeights: o.ankleWeights !== false, bands: o.bands !== false, heavyBag: o.heavyBag !== false, rope: o.rope !== false, box: o.box !== false };
}
