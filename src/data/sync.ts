import { camera, equipment, history, progress, schedule, userRoutines, type SessionRecord } from './library';
import { createStore } from './store';
import { supabase } from './supabase';
import { applyBundle, bundleOf, decideSettings, mergeSessions, type Bundle } from './syncRules';

export type SyncStatus = 'signed-out' | 'syncing' | 'ok' | 'offline';
interface Meta { owner: string | null; syncedAt: number; changedAt: number; sent: string[]; status: SyncStatus; lastAt: number; message: string }

/** Where this device stands with the cloud. `owner` is whose data is on this phone. */
export const sync = createStore<Meta>('tkd.sync.v1', { owner: null, syncedAt: 0, changedAt: 0, sent: [], status: 'signed-out', lastAt: 0, message: '' }, (v, d) => {
  const o = (v ?? {}) as Partial<Meta>;
  return { owner: typeof o.owner === 'string' ? o.owner : null, syncedAt: Number(o.syncedAt) || 0, changedAt: Number(o.changedAt) || 0, sent: Array.isArray(o.sent) ? o.sent.filter((x): x is string => typeof x === 'string').slice(-6000) : [], status: 'signed-out', lastAt: Number(o.lastAt) || 0, message: d.message };
});

let applying = false;   // true while we write cloud data into the local stores, so it is not mistaken for a local change
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;

const gather = (): Bundle => bundleOf({ camera: camera.get(), progress: progress.get(), schedule: schedule.get(), routines: userRoutines.get(), equipment: equipment.get() }, Date.now());

function wipeLocal() {
  applying = true;
  history.reset(); progress.reset(); camera.reset(); schedule.reset(); userRoutines.reset(); equipment.reset();
  applying = false;
}
function applyRemote(b: Bundle) {
  const c = applyBundle(b);
  applying = true;
  camera.replace(c.camera); progress.replace(c.progress); schedule.replace(c.schedule); userRoutines.replace(c.routines); equipment.replace(c.equipment);
  applying = false;
}

async function pushSettings(uid: string) {
  const { error } = await supabase.from('user_settings').upsert({ user_id: uid, data: gather(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function syncSessions(uid: string) {
  const { data, error } = await supabase.from('sessions').select('id,payload').eq('user_id', uid).order('date', { ascending: false }).limit(2000);
  if (error) throw error;
  const remote = (data ?? []).map((r) => r.payload as SessionRecord);
  const remoteIds = new Set((data ?? []).map((r) => r.id as string));
  applying = true;
  history.set((local) => mergeSessions(local, remote));
  applying = false;
  const todo = history.get().filter((r) => !remoteIds.has(r.id) && /^[A-Za-z0-9_-]{1,60}$/.test(r.id));
  for (let i = 0; i < todo.length; i += 50) {
    const rows = todo.slice(i, i + 50).map((r) => ({ user_id: uid, id: r.id, date: r.date, payload: r }));
    const { error: e } = await supabase.from('sessions').upsert(rows, { onConflict: 'user_id,id' });
    if (e) throw e;
  }
}

/** One full round: decide who wins, move settings, then merge sessions. Safe to call any time. */
export function syncNow(): Promise<void> {
  if (!userId) return Promise.resolve();
  if (running) return running;
  const uid = userId;
  running = (async () => {
    sync.set((m) => ({ ...m, status: 'syncing', message: '' }));
    try {
      const { data: row, error } = await supabase.from('user_settings').select('data,updated_at').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      const m = sync.get();
      const d = decideSettings({ owner: m.owner, user: uid, hasRemote: !!row, remoteAt: row ? Date.parse(row.updated_at as string) || 0 : 0, syncedAt: m.syncedAt, changedAt: m.changedAt });
      if (d === 'wipe-then-pull' || d === 'wipe') wipeLocal();
      if (d === 'pull' || d === 'wipe-then-pull') applyRemote(row!.data as Bundle);
      if (d === 'push' || d === 'wipe') await pushSettings(uid);
      await syncSessions(uid);
      const now = Date.now();
      sync.set((x) => ({ ...x, owner: uid, syncedAt: now, changedAt: Math.min(x.changedAt, now), status: 'ok', lastAt: now, message: '' }));
    } catch (e) {
      sync.set((x) => ({ ...x, status: 'offline', message: (e as { message?: string })?.message?.slice(0, 120) ?? 'Could not reach the cloud' }));
    } finally { running = null; }
  })();
  return running;
}

const later = () => { clearTimeout(timer); timer = setTimeout(() => { void syncNow(); }, 2000); };
const changed = () => { if (applying) return; sync.set((m) => ({ ...m, changedAt: Date.now() })); if (userId) later(); };

let started = false;
/** Call once at startup. Syncs when you sign in, a little after anything changes, and when the phone comes back online. */
export function startSync() {
  if (started) return;
  started = true;
  [camera, progress, schedule, userRoutines, equipment, history].forEach((s) => s.watch(changed));
  supabase.auth.onAuthStateChange((_e, session) => {
    const id = session?.user?.id ?? null;
    if (id === userId) return;
    userId = id;
    if (id) void syncNow(); else sync.set((m) => ({ ...m, status: 'signed-out' }));
  });
  addEventListener('online', () => { if (userId) void syncNow(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && userId && sync.get().status === 'offline') void syncNow(); });
}

/** Best effort final upload before signing out. */
export async function flush(): Promise<void> { if (userId && sync.get().changedAt > sync.get().syncedAt) await syncNow(); }
