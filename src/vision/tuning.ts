import { exerciseById } from '../data/exercises';
import { learnFromSamples, PROFILES } from './profiles';
import { DEFAULT_REP_CONFIG, type RepConfig } from './repCounter';
import { toFrames, type Sample } from './samples';
import { Tracker } from './tracker';

export interface Tuned {
  exerciseId: string;
  samples: number;
  kickCfg?: Partial<RepConfig>;
  motionThreshold?: number;
  before: { counted: number; expected: number; extra: number };
  after: { counted: number; expected: number; extra: number };
  ok: boolean;
  advice: string;
}

type Frames = ReturnType<typeof toFrames>;
const expectedFor = (s: Sample) => ({ left: s.leg === 'right' ? 0 : s.expected, right: s.leg === 'left' ? 0 : s.expected });

function score(frames: Frames[], samples: Sample[], cfg: RepConfig) {
  let counted = 0, extra = 0, expected = 0, error = 0;
  frames.forEach((fr, i) => {
    const tr = new Tracker({ ...cfg });
    fr.forEach((f) => tr.update(f.t, f.lm));
    const got = tr.reps, want = expectedFor(samples[i]);
    counted += Math.min(got.left, want.left) + Math.min(got.right, want.right);
    extra += Math.max(0, got.left - want.left) + Math.max(0, got.right - want.right);
    expected += want.left + want.right;
    error += Math.abs(got.left - want.left) + Math.abs(got.right - want.right);
  });
  return { counted, extra, expected, error };
}

function candidates(): RepConfig[] {
  const out: { c: RepConfig; cost: number }[] = [];
  for (const h of [-0.2, -0.3, -0.4, -0.5, -0.6]) for (const ext of [150, 140, 130]) for (const ch of [100, 110, 120]) {
    out.push({ c: { ...DEFAULT_REP_CONFIG, kickHeight: h, extendAngle: ext, chamberAngle: ch, returnAngle: Math.max(ch + 8, ext - 30) }, cost: (-0.2 - h) * 10 + (150 - ext) / 10 + (ch - 100) / 10 });
  }
  return out.sort((a, b) => a.cost - b.cost).map((x) => x.c);
}

/**
 * Fits the tracker to how you do one exercise, from your own recordings of it.
 * Kicks: finds the kick settings that count your real rep numbers best, preferring settings close to the standard ones.
 * Anything else: learns how much movement counts as moving for you on this exercise.
 */
export function tuneExercise(exerciseId: string, all: Sample[]): Tuned {
  const samples = all.filter((s) => s.exerciseId === exerciseId);
  const ex = exerciseById(exerciseId);
  const frames = samples.map(toFrames);
  const empty = { counted: 0, expected: 0, extra: 0 };

  if (ex?.verify === 'reps') {
    const base = score(frames, samples, DEFAULT_REP_CONFIG);
    let best = { cfg: DEFAULT_REP_CONFIG, s: base };
    if (base.error > 0) {
      for (const cfg of candidates()) {
        const s = score(frames, samples, cfg);
        if (s.error < best.s.error) best = { cfg, s };
        if (s.error === 0) break;
      }
    }
    const diff: Partial<RepConfig> = {};
    (['kickHeight', 'extendAngle', 'chamberAngle', 'returnAngle'] as const).forEach((k) => { if (best.cfg[k] !== DEFAULT_REP_CONFIG[k]) diff[k] = best.cfg[k]; });
    const tol = Math.max(0, Math.floor(best.s.expected / 10));
    const learnable = best.s.counted >= Math.ceil(best.s.expected * 0.6) && best.s.counted > 0;
    const ok = best.s.error <= tol && best.s.expected > 0;
    return {
      exerciseId, samples: samples.length,
      kickCfg: learnable && Object.keys(diff).length ? diff : undefined,
      before: { counted: base.counted, expected: base.expected, extra: base.extra },
      after: { counted: best.s.counted, expected: best.s.expected, extra: best.s.extra },
      ok,
      advice: ok ? (Object.keys(diff).length ? 'Tuned to how you kick this.' : 'The standard settings already count this correctly.')
        : best.s.counted === 0 ? 'I did not see any kicks. Put the phone to your side so the kick goes across the screen, keep the whole leg in view, and try again.'
        : 'Close, but not exact. Try another take with the phone a little farther back.',
    };
  }

  // Not a kick: learn how you move on this one.
  const seen: { present: boolean; motion: number }[] = [];
  frames.forEach((fr) => { const tr = new Tracker({ ...DEFAULT_REP_CONFIG }, PROFILES.relaxed); fr.forEach((f) => { const r = tr.update(f.t, f.lm); seen.push({ present: r.present, motion: r.motion }); }); });
  const learned = learnFromSamples(seen);
  return {
    exerciseId, samples: samples.length, motionThreshold: learned.ok ? learned.moveThreshold : undefined,
    before: empty, after: empty, ok: learned.ok,
    advice: learned.ok ? learned.advice : learned.advice.replace('I could not see you for much of that.', 'I could not see you for much of that recording.'),
  };
}
