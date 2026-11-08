export type BeepType = 'tick' | 'double' | 'triple' | 'low' | 'high' | 'bell' | 'sweep';
export type BeepKind = 'alert' | 'start' | 'end' | 'switch' | 'phase';
export type VibrateMode = 'short' | 'double' | 'long' | 'off';

export interface AlertConfig {
  atSecondsRemaining: number[];
  halfway: boolean;
  beepOnStart: boolean;
  beepOnEnd: boolean;
  endSound: boolean;
  restToWorkChange: boolean;
  beepType: BeepType;
  volume: number; // 0 to 1, software gain
  vibrate: VibrateMode;
}

export const DEFAULT_ALERTS: AlertConfig = {
  atSecondsRemaining: [10],
  halfway: false,
  beepOnStart: false,
  beepOnEnd: true,
  endSound: true,
  restToWorkChange: true,
  beepType: 'double',
  volume: 0.8,
  vibrate: 'short',
};

export const PRESETS = {
  lastTen: [10],
  countdown5: [5, 4, 3, 2, 1],
} as const;

export interface Beep { at: number; kind: BeepKind; type: BeepType }

/**
 * Pure beep timeline for one block. `durations` are the segments of the block
 * (one entry, or two for a left/right hold). Times are seconds from block start.
 */
export function segmentTimeline(durations: number[], cfg: AlertConfig, opts: { phaseChange?: boolean } = {}): Beep[] {
  const out: Beep[] = [];
  if (opts.phaseChange && cfg.restToWorkChange) out.push({ at: 0, kind: 'phase', type: 'sweep' });
  else if (cfg.beepOnStart) out.push({ at: 0, kind: 'start', type: cfg.beepType });

  let offset = 0;
  durations.forEach((d, i) => {
    const last = i === durations.length - 1;
    const rems = new Set(cfg.atSecondsRemaining.filter((r) => r > 0 && r < d));
    for (const r of rems) out.push({ at: offset + d - r, kind: 'alert', type: cfg.beepType });
    if (cfg.halfway && d >= 4) out.push({ at: offset + d / 2, kind: 'alert', type: cfg.beepType });
    if (!last) out.push({ at: offset + d, kind: 'switch', type: 'triple' });
    else if (cfg.beepOnEnd) out.push({ at: offset + d, kind: 'end', type: cfg.endSound ? 'bell' : cfg.beepType });
    offset += d;
  });
  return out.sort((a, b) => a.at - b.at);
}

/** Beeps with from < at <= to. Used by the scheduler so each beep is returned once. */
export function dueBeeps(timeline: Beep[], fromExclusive: number, toInclusive: number): Beep[] {
  return timeline.filter((b) => b.at > fromExclusive && b.at <= toInclusive);
}

export function segmentAt(durations: number[], elapsed: number): { index: number; remaining: number } {
  let start = 0;
  for (let i = 0; i < durations.length; i++) {
    const end = start + durations[i];
    if (elapsed < end || i === durations.length - 1) return { index: i, remaining: Math.max(0, end - elapsed) };
    start = end;
  }
  return { index: 0, remaining: 0 };
}

export function parseSeconds(text: string): number[] {
  return [...new Set(text.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 3600).map(Math.round))].sort((a, b) => b - a);
}
