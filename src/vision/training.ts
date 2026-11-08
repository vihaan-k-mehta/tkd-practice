import { DEFAULT_REP_CONFIG, type RepConfig } from './repCounter';
import { Tracker } from './tracker';
import type { Lm } from './types';
import type { Sensitivity } from './profiles';

/** The guided script. `say` is both shown on screen and spoken. */
export type StepId = 'frame' | 'still' | 'stretch' | 'swings' | 'kicksL' | 'kicksR' | 'out';
export interface Step { id: StepId; title: string; say: string; seconds: number; kicks?: 'left' | 'right' }
export const KICKS_EACH = 5;
export const STEPS: Step[] = [
  { id: 'frame', title: 'Get in position', say: 'Stand sideways to the phone, two to three metres back, arms relaxed. I am checking that I can see you.', seconds: 6 },
  { id: 'still', title: 'Stand still', say: 'Now stand completely still.', seconds: 5 },
  { id: 'stretch', title: 'A stretch', say: 'Do a stretch you normally do. A hamstring stretch, a lunge or a deep squat are all fine.', seconds: 12 },
  { id: 'swings', title: 'Leg swings', say: 'Now swing your legs, front to back, about ten each leg.', seconds: 14 },
  { id: 'kicksL', title: 'Left leg kicks', say: `Throw ${KICKS_EACH} kicks with your left leg, one every couple of seconds, towards the side of the room.`, seconds: 16, kicks: 'left' },
  { id: 'kicksR', title: 'Right leg kicks', say: `Now ${KICKS_EACH} kicks with your right leg.`, seconds: 16, kicks: 'right' },
  { id: 'out', title: 'Walk out', say: 'Finally, walk out of the picture and stay out.', seconds: 6 },
];

export interface Sample { present: boolean; inFrame: boolean; motion: number }
export interface StepData { id: StepId; samples: Sample[]; frames?: { t: number; lm: Lm[] | null }[] }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pct = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0);

export function summarize(samples: Sample[]) {
  const n = samples.length;
  const seen = samples.filter((s) => s.present);
  const m = seen.map((s) => s.motion).sort((a, b) => a - b);
  return { n, presentRate: n ? seen.length / n : 0, inFrameRate: n ? samples.filter((s) => s.inFrame).length / n : 0, p25: pct(m, 0.25), p50: pct(m, 0.5), p90: pct(m, 0.9) };
}

/* ---------- fitting the kick counter ---------- */
export interface KickFit { cfg: RepConfig; counted: { left: number; right: number }; error: number }

function candidates(): RepConfig[] {
  const out: { c: RepConfig; cost: number }[] = [];
  for (const h of [-0.2, -0.3, -0.4, -0.5, -0.6]) for (const ext of [150, 140, 130]) for (const ch of [100, 110, 120]) {
    const c: RepConfig = { ...DEFAULT_REP_CONFIG, kickHeight: h, extendAngle: ext, chamberAngle: ch, returnAngle: Math.max(ch + 8, ext - 30) };
    out.push({ c, cost: (-0.2 - h) * 10 + (150 - ext) / 10 + (ch - 100) / 10 });
  }
  return out.sort((a, b) => a.cost - b.cost).map((x) => x.c);
}

function run(frames: { t: number; lm: Lm[] | null }[], cfg: RepConfig) {
  const tr = new Tracker({ ...cfg });
  for (const f of frames) tr.update(f.t, f.lm);
  return tr.reps;
}

/**
 * Tries the standard kick settings first, then progressively more forgiving ones, and keeps the first that counts
 * your kicks best. Wrong counts on either leg are errors, so it cannot get there just by counting everything.
 */
export function tuneKicks(frames: { t: number; lm: Lm[] | null }[], expected: { left: number; right: number }, list: RepConfig[] = candidates()): KickFit {
  let best: KickFit | null = null;
  for (const cfg of list) {
    const counted = run(frames, cfg);
    const error = Math.abs(counted.left - expected.left) + Math.abs(counted.right - expected.right);
    if (!best || error < best.error) best = { cfg, counted, error };
    if (error === 0) break; // candidates are ordered from closest to the standard, so the first perfect fit wins
  }
  return best!;
}

/* ---------- the report ---------- */
export interface Row { id: StepId | 'speed'; label: string; status: 'ok' | 'warn'; detail: string; advice?: string }
export interface Settings { motionThreshold?: number; kickCfg?: Partial<RepConfig>; sensitivity?: Sensitivity; quality?: 'full' | 'lite' }
export interface Report { ok: boolean; rows: Row[]; settings: Settings; counted: { left: number; right: number } | null; summary: string }

const pc = (x: number) => `${Math.round(x * 100)} percent`;

export function analyze(data: Partial<Record<StepId, StepData>>, ctx: { fps: number; sensitivity: Sensitivity; quality: 'full' | 'lite' }): Report {
  const rows: Row[] = [];
  const settings: Settings = {};
  const get = (id: StepId) => (data[id] ? summarize(data[id]!.samples) : null);
  const have = STEPS.filter((s) => data[s.id] && summarize(data[s.id]!.samples).n >= 10).length;
  if (have < 3) return { ok: false, rows, settings, counted: null, summary: 'Not enough was captured to learn anything. Try again with the phone propped up and a clear view of the room.' };

  const frame = get('frame'), still = get('still'), stretch = get('stretch'), swings = get('swings'), out = get('out');

  if (frame) rows.push(frame.presentRate >= 0.8
    ? { id: 'frame', label: 'Getting in position', status: 'ok', detail: `Seen ${pc(frame.presentRate)} of the time.` }
    : { id: 'frame', label: 'Getting in position', status: 'warn', detail: `Seen only ${pc(frame.presentRate)} of the time.`, advice: 'Move the phone farther away or to a better angle, and add light in front of you.' });

  const noise = still ? still.p90 : 0.05;
  if (still) rows.push({ id: 'still', label: 'Standing still', status: 'ok', detail: `Steady. Jitter level ${noise.toFixed(2)}.` });

  if (stretch) rows.push(stretch.presentRate >= 0.85
    ? { id: 'stretch', label: 'Stretching', status: 'ok', detail: `Seen ${pc(stretch.presentRate)} of the time.` }
    : { id: 'stretch', label: 'Stretching', status: 'warn', detail: `Seen only ${pc(stretch.presentRate)} of the time.`, advice: 'Stretches lose tracking when the phone is too close or the light is behind you. Move the phone back, change the angle, or face the light.' });
  if (stretch && stretch.presentRate < 0.8 && ctx.sensitivity !== 'relaxed') settings.sensitivity = 'relaxed';

  if (swings) {
    const thr = clamp(Math.max(0.5 * swings.p25, 2 * noise), 0.04, 0.3);
    const separable = swings.p25 >= 1.5 * noise;
    if (swings.presentRate >= 0.6) settings.motionThreshold = Number(thr.toFixed(3)); // never learn from a step where you were mostly not seen
    rows.push(swings.presentRate >= 0.8 && separable
      ? { id: 'swings', label: 'Leg swings', status: 'ok', detail: `Seen ${pc(swings.presentRate)} of the time. Movement counts above ${thr.toFixed(2)}.` }
      : { id: 'swings', label: 'Leg swings', status: 'warn', detail: swings.presentRate < 0.8 ? `Seen only ${pc(swings.presentRate)} of the time.` : 'Your swings were barely above standing-still jitter.',
          advice: swings.presentRate < 0.8 ? 'Keep your whole leg in view while swinging.' : 'Prop the phone on something steadier, such as a shelf or a tripod, so it does not shake.' });
  }

  // kicks: replay what was recorded against candidate settings
  let counted: { left: number; right: number } | null = null;
  const L = data.kicksL?.frames, R = data.kicksR?.frames;
  if (L && R && (L.length > 20 || R.length > 20)) {
    const shift = (L.length ? L[L.length - 1].t : 0) + 2000 - (R.length ? R[0].t : 0);
    const frames = [...L, ...R.map((f) => ({ ...f, t: f.t + shift }))];
    const fit = tuneKicks(frames, { left: KICKS_EACH, right: KICKS_EACH });
    counted = fit.counted;
    const learnable = fit.counted.left + fit.counted.right >= 6;
    if (learnable) {
      const diff: Partial<RepConfig> = {};
      (['kickHeight', 'extendAngle', 'chamberAngle', 'returnAngle'] as const).forEach((k) => { if (fit.cfg[k] !== DEFAULT_REP_CONFIG[k]) diff[k] = fit.cfg[k]; });
      if (Object.keys(diff).length) settings.kickCfg = diff;
    }
    const kickRow = (id: 'kicksL' | 'kicksR', name: string, n: number): Row => n >= KICKS_EACH - 1 && n <= KICKS_EACH
      ? { id, label: `${name} kicks`, status: 'ok', detail: `Counted ${n} of ${KICKS_EACH}.` }
      : { id, label: `${name} kicks`, status: 'warn', detail: `Counted ${n} of ${KICKS_EACH}.`,
          advice: n === 0 ? 'I did not see any kicks. Put the phone to your side so the kick goes across the screen, and keep the whole leg in view.' : 'Some kicks were missed or extra were counted. Try the phone a little farther back, or train again.' };
    rows.push(kickRow('kicksL', 'Left', fit.counted.left), kickRow('kicksR', 'Right', fit.counted.right));
  } else {
    rows.push({ id: 'kicksL', label: 'Left kicks', status: 'warn', detail: 'No kicks were recorded.', advice: 'Kick towards the side of the room with the phone to your side.' });
    rows.push({ id: 'kicksR', label: 'Right kicks', status: 'warn', detail: 'No kicks were recorded.', advice: 'Kick towards the side of the room with the phone to your side.' });
  }

  if (out) {
    if (out.presentRate <= 0.3) rows.push({ id: 'out', label: 'Leaving the picture', status: 'ok', detail: 'It noticed when you left.' });
    else {
      rows.push({ id: 'out', label: 'Leaving the picture', status: 'warn', detail: `It still thought someone was there ${pc(out.presentRate)} of the time.`, advice: 'Something in the room may look like a person to it. Choosing Normal or Strict will make it stricter.' });
      settings.sensitivity = ctx.sensitivity === 'relaxed' ? 'normal' : 'strict';
    }
  }

  rows.push(ctx.fps >= 8
    ? { id: 'speed', label: 'Phone speed', status: 'ok', detail: `Tracking at about ${Math.round(ctx.fps)} frames a second.` }
    : { id: 'speed', label: 'Phone speed', status: 'warn', detail: `Only about ${Math.round(ctx.fps)} frames a second.`, advice: 'The accurate model is too heavy for this phone, so I switched to the fast one.' });
  if (ctx.fps < 8 && ctx.quality === 'full') settings.quality = 'lite';

  const bad = rows.filter((r) => r.status === 'warn').length;
  const changed = Object.keys(settings).length;
  return {
    ok: bad === 0, rows, settings, counted,
    summary: bad === 0
      ? `All good. I trained the camera to you${changed ? ' and saved the new settings' : ''}.`
      : `${bad} thing${bad > 1 ? 's' : ''} to look at. I saved what I could learn${changed ? '' : ' (nothing changed yet)'}.`,
  };
}
