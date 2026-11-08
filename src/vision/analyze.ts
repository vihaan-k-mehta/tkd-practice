import { exerciseById } from '../data/exercises';
import type { Sample } from './samples';
import type { RepConfig } from './repCounter';
import { tuneExercise } from './tuning';

export interface ExportFile { app?: string; version?: number; samples?: Sample[] }
export interface AnalysisRow { exerciseId: string; name: string; samples: number; before: string; after: string; cfg?: Partial<RepConfig>; motionThreshold?: number; advice: string }

const sane = (s: unknown): s is Sample => !!s && typeof s === 'object' && typeof (s as Sample).exerciseId === 'string' && Array.isArray((s as Sample).frames) && typeof (s as Sample).expected === 'number';

/** Used by the app and by the command line tool: how well does the tracker do on each exercise you recorded, and what would fix it. */
export function analyzeExport(file: ExportFile) {
  const samples = (Array.isArray(file?.samples) ? file.samples : []).filter(sane);
  const ids = [...new Set(samples.map((s) => s.exerciseId))];
  const rows: AnalysisRow[] = ids.map((id) => {
    const t = tuneExercise(id, samples);
    const isKick = exerciseById(id)?.verify === 'reps';
    return {
      exerciseId: id, name: exerciseById(id)?.name ?? id, samples: t.samples,
      before: isKick ? `${t.before.counted}/${t.before.expected}` : 'n/a', after: isKick ? `${t.after.counted}/${t.after.expected}` : 'n/a',
      cfg: t.kickCfg, motionThreshold: t.motionThreshold, advice: t.advice,
    };
  });
  // If several kick exercises all needed the same loosening, the standard defaults themselves are probably too strict.
  const loosened = rows.filter((r) => r.cfg?.kickHeight !== undefined);
  const suggestedDefaults = loosened.length >= 2 ? { kickHeight: Math.max(...loosened.map((r) => r.cfg!.kickHeight!)) } as Partial<RepConfig> : undefined;
  return { rows, suggestedDefaults };
}
