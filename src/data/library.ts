import { createStore } from './store';
import { cleanProgress, cleanRoutines, cleanSchedule } from './sanitize';
import { freshProgress, type Progress } from '../engine/quests';
import { TEMPLATES } from './templates';
import type { Equipment, Routine } from './types';
import { emptySchedule, type Schedule } from '../engine/schedule';

export const userRoutines = createStore<Routine[]>('tkd.routines.v1', [], (v) => cleanRoutines(v));
export const equipment = createStore<Record<Equipment, boolean>>('tkd.equipment.v1', { ankleWeights: true, bands: true, heavyBag: true, rope: true, box: true });
export const lastRoutine = createStore<{ id: string }>('tkd.last.v1', { id: 'daily-stretch' });

export interface SessionRecord {
  id: string; date: string; routineId: string; routineName: string; totalSec: number;
  /** True when a camera-checked block was done without the camera (honor mode): half XP, never on a leaderboard. */
  unverified?: boolean;
  /** Foot-down alarms, and how many were not fixed in time (each costs XP). */
  drops?: number; penalties?: number;
  /** Highest leg hold, in torso lengths above the standing foot. */
  holdPeak?: number;
  blocks: { exerciseId: string; name: string; plannedSec: number; actualSec: number; completed: boolean; verifiedSec?: number; /** Ankle weight in pounds, and sets done. */ weightLb?: number; sets?: number; reps?: { left: number; right: number; any: number }; hurt?: boolean }[];
}
export const history = createStore<SessionRecord[]>('tkd.history.v1', []);

/** Local YYYY-MM-DD, never UTC. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const schedule = createStore<Schedule>('tkd.schedule.v1', emptySchedule(localDate()), (v, d) => cleanSchedule(v, d));

export const progress = createStore<Progress>('tkd.progress.v1', freshProgress(localDate()), (v, d) => cleanProgress(v, d));
/** What the last app-open judged, shown once on Today. */
export const notice = createStore<{ lines: string[] }>('tkd.notice.v1', { lines: [] }, (v) => ({ lines: Array.isArray((v as { lines?: unknown })?.lines) ? ((v as { lines: unknown[] }).lines).filter((x): x is string => typeof x === 'string').slice(0, 10).map((x) => x.slice(0, 140)) : [] }));

export interface CameraSettings { use: boolean; honor: boolean; skeleton: boolean; kickHeight?: number; sensitivity: 'relaxed' | 'normal' | 'strict'; quality: 'full' | 'lite'; motionThreshold?: number; kickCfg?: { kickHeight?: number; extendAngle?: number; chamberAngle?: number; returnAngle?: number } }
export const camera = createStore<CameraSettings>('tkd.camera.v1', { use: true, honor: false, skeleton: false, sensitivity: 'relaxed', quality: 'full' }, (v, d) => {
  const o = (v ?? {}) as Record<string, unknown>;
  const kh = typeof o.kickHeight === 'number' && Number.isFinite(o.kickHeight) ? Math.max(-1, Math.min(1, o.kickHeight)) : undefined;
  const mt = typeof o.motionThreshold === 'number' && Number.isFinite(o.motionThreshold) ? Math.max(0.02, Math.min(0.5, o.motionThreshold)) : undefined;
  const sens = o.sensitivity === 'normal' || o.sensitivity === 'strict' ? o.sensitivity : d.sensitivity;
  const kc = (o.kickCfg ?? {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
  const kickCfg = { kickHeight: num(kc.kickHeight, -1, 1), extendAngle: num(kc.extendAngle, 100, 175), chamberAngle: num(kc.chamberAngle, 40, 140), returnAngle: num(kc.returnAngle, 60, 170) };
  const hasKick = Object.values(kickCfg).some((x) => x !== undefined);
  return { kickCfg: hasKick ? kickCfg : undefined, use: o.use !== false, honor: o.honor === true, skeleton: o.skeleton === true, kickHeight: kh, sensitivity: sens, quality: o.quality === 'lite' ? 'lite' : 'full', motionThreshold: mt };
});

export const uid =() => Math.random().toString(36).slice(2, 10);
/** The most recent shortened routine, so a session can run it without cluttering the saved list. */
export const quickRoutine = createStore<{ routine?: Routine }>('tkd.quick.v1', {}, (v) => ({ routine: cleanRoutines([(v as { routine?: unknown })?.routine])[0] }));
export const getRoutine = (id: string, mine: Routine[] = userRoutines.get()): Routine | undefined =>
  TEMPLATES.find((t) => t.id === id) ?? mine.find((r) => r.id === id) ?? (quickRoutine.get().routine?.id === id ? quickRoutine.get().routine : undefined);

export function saveRoutine(r: Routine) {
  userRoutines.set((list) => (list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]));
}
export const deleteRoutine = (id: string) => userRoutines.set((l) => l.filter((r) => r.id !== id));
