import type { SessionRecord, CameraSettings } from './library';
import type { Equipment, Routine } from './types';
import { cleanCamera, cleanProgress, cleanRoutines, cleanSchedule, cleanEquipment, DEFAULT_CAMERA } from './sanitize';
import { freshProgress, type Progress } from '../engine/quests';
import { emptySchedule, type Schedule } from '../engine/schedule';

/** What is saved to the cloud for each user. Settings and progress only: no video, no body points. */
export interface Bundle {
  updatedAt: number;
  camera: CameraSettings;
  progress: Progress;
  schedule: Schedule;
  routines: Routine[];
  equipment: Record<Equipment, boolean>;
}

export const bundleOf = (s: Omit<Bundle, 'updatedAt'>, at: number): Bundle => ({ updatedAt: at, ...s });

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Whatever came back from the cloud is untrusted: every part is cleaned before it is used. */
export function applyBundle(b: Bundle): Omit<Bundle, 'updatedAt'> {
  const o = (b && typeof b === 'object' ? b : {}) as Partial<Record<keyof Bundle, unknown>>;
  return {
    camera: cleanCamera(o.camera, DEFAULT_CAMERA),
    progress: cleanProgress(o.progress, freshProgress(today())),
    schedule: cleanSchedule(o.schedule, emptySchedule(today())),
    routines: cleanRoutines(o.routines),
    equipment: cleanEquipment(o.equipment),
  };
}

const valid = (r: unknown): r is SessionRecord => !!r && typeof r === 'object' && typeof (r as SessionRecord).id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((r as SessionRecord).date ?? '') && Array.isArray((r as SessionRecord).blocks);

/** Union of both lists, one copy per id (this device's copy wins), newest first. Bad rows are dropped. */
export function mergeSessions(local: SessionRecord[], remote: SessionRecord[]): SessionRecord[] {
  const byId = new Map<string, SessionRecord>();
  for (const r of remote) if (valid(r)) byId.set(r.id, r);
  for (const r of local) if (valid(r)) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export type Decision = 'push' | 'pull' | 'wipe-then-pull' | 'wipe' | 'none';

/** On sign-in: should this device send its settings up, take the cloud copy, or leave things alone? */
export function decideSettings(i: { owner: string | null; user: string; hasRemote: boolean; remoteAt: number; syncedAt: number; changedAt: number }): Decision {
  if (i.owner && i.owner !== i.user) return i.hasRemote ? 'wipe-then-pull' : 'wipe'; // another account used this phone: keep accounts separate, never upload their data
  if (!i.hasRemote) return 'push';
  if (!i.owner) return 'pull';                                // first sign-in here: the account's own data wins
  if (i.changedAt > i.syncedAt) return 'push';                // changed on this device since the last sync
  return i.remoteAt > i.syncedAt ? 'pull' : 'none';
}
