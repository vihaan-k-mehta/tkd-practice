import { camera, uid } from './library';
import { supabase } from './supabase';
import type { Sample } from '../vision/samples';
import { tuneExercise, type Tuned } from '../vision/tuning';

/** Recordings live in IndexedDB (they are too big for localStorage). If it is unavailable they live in memory for this visit only. */
const DB = 'tkd-samples', STORE = 'samples';
let mem: Sample[] = [];
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const wrap = <T>(req: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function allSamples(): Promise<Sample[]> {
  const db = await open();
  if (!db) return [...mem];
  try { return (await wrap(db.transaction(STORE).objectStore(STORE).getAll())) as Sample[]; } catch { return [...mem]; }
}
export const samplesFor = async (exerciseId: string) => (await allSamples()).filter((s) => s.exerciseId === exerciseId);

export async function putSample(s: Sample): Promise<void> {
  mem = [...mem.filter((x) => x.id !== s.id), s];
  const db = await open();
  if (!db) return;
  try { await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).put(s)); } catch { /* kept in memory */ }
}
export async function deleteSamplesFor(exerciseId: string): Promise<void> {
  mem = mem.filter((x) => x.exerciseId !== exerciseId);
  const db = await open();
  if (!db) return;
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  for (const s of (await wrap(store.getAll())) as Sample[]) if (s.exerciseId === exerciseId) store.delete(s.id);
}
export async function clearSamples(): Promise<void> {
  mem = [];
  const db = await open();
  if (db) try { await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).clear()); } catch { /* ignore */ }
}

/** Remember what tuning each exercise got. Works on top of the general camera settings. */
export function applyTuning(t: Tuned) {
  camera.set((c) => ({
    ...c,
    exercise: { ...c.exercise, [t.exerciseId]: { motionThreshold: t.motionThreshold, kickCfg: t.kickCfg, samples: t.samples, counted: t.after.counted, expected: t.after.expected } },
  }));
}
export const forgetTuning = (exerciseId: string) => camera.set((c) => { const e = { ...c.exercise }; delete e[exerciseId]; return { ...c, exercise: e }; });

/** Save a recording, tune that exercise from every recording of it, and send a copy to the account if signed in. */
export async function keepSample(s: Sample): Promise<Tuned> {
  await putSample(s);
  const t = tuneExercise(s.exerciseId, await samplesFor(s.exerciseId));
  applyTuning(t);
  void uploadSample(s);
  return t;
}

export const newSampleId = () => `${Date.now().toString(36)}${uid()}`.slice(0, 30);

export async function uploadSample(s: Sample): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return false;
    const { error } = await supabase.from('training_samples').upsert({ user_id: user.id, id: s.id, exercise_id: s.exerciseId, expected: s.expected, fps: s.fps, frames: s.frames, note: s.note ?? null });
    return !error;
  } catch { return false; }
}

/** One file with every recording and the tuning that came from it, to send for analysis. Contains no video and no name. */
export async function exportData() {
  const samples = await allSamples();
  const c = camera.get();
  return { app: 'tkd-practice', version: 1, exportedAt: new Date().toISOString(), settings: { sensitivity: c.sensitivity, quality: c.quality, motionThreshold: c.motionThreshold, kickCfg: c.kickCfg }, tuning: c.exercise, samples };
}

export async function downloadExport() {
  const blob = new Blob([JSON.stringify(await exportData())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tkd-training-data.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
