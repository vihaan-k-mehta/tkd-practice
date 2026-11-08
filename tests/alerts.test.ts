import { describe, it, expect } from 'vitest';
import { DEFAULT_ALERTS, segmentTimeline, dueBeeps, segmentAt, type AlertConfig } from '../src/engine/alerts';

const cfg = (o: Partial<AlertConfig> = {}): AlertConfig => ({ ...DEFAULT_ALERTS, ...o });
const times = (b: { at: number }[]) => b.map((x) => x.at);

describe('segmentTimeline', () => {
  it('60 s block with alerts at 10 s and a 3,2,1 countdown beeps at 50, 57, 58, 59, 60', () => {
    const t = segmentTimeline([60], cfg({ atSecondsRemaining: [10, 3, 2, 1], beepOnEnd: true, beepOnStart: false }));
    expect(times(t)).toEqual([50, 57, 58, 59, 60]);
    expect(t[t.length - 1].kind).toBe('end');
  });

  it('default config: one beep at 10 s remaining plus the end sound', () => {
    expect(times(segmentTimeline([60], DEFAULT_ALERTS))).toEqual([50, 60]);
  });

  it('ignores alert times that do not fit inside the block', () => {
    expect(times(segmentTimeline([8], cfg({ atSecondsRemaining: [10, 5] })))).toEqual([3, 8]);
  });

  it('adds a start beep when enabled', () => {
    const t = segmentTimeline([30], cfg({ atSecondsRemaining: [], beepOnStart: true }));
    expect(t.map((b) => [b.at, b.kind])).toEqual([[0, 'start'], [30, 'end']]);
  });

  it('uses a distinct phase beep for rest to work and not a second start beep', () => {
    const t = segmentTimeline([30], cfg({ atSecondsRemaining: [], beepOnStart: true }), { phaseChange: true });
    expect(t.filter((b) => b.at === 0).map((b) => b.kind)).toEqual(['phase']);
  });

  it('two-sided hold: per-side alerts, a switch beep at the half, end beep at the very end', () => {
    const t = segmentTimeline([30, 30], cfg({ atSecondsRemaining: [5] }));
    expect(t.map((b) => [b.at, b.kind])).toEqual([[25, 'alert'], [30, 'switch'], [55, 'alert'], [60, 'end']]);
  });

  it('halfway alert', () => {
    const t = segmentTimeline([60], cfg({ atSecondsRemaining: [], halfway: true }));
    expect(times(t)).toEqual([30, 60]);
  });

  it('end beep can be turned off', () => {
    expect(times(segmentTimeline([20], cfg({ atSecondsRemaining: [], beepOnEnd: false })))).toEqual([]);
  });

  it('end sound is the long bell when enabled, the chosen beep when not', () => {
    expect(segmentTimeline([20], cfg({ endSound: true })).at(-1)?.type).toBe('bell');
    expect(segmentTimeline([20], cfg({ endSound: false, beepType: 'low' })).at(-1)?.type).toBe('low');
  });
});

describe('dueBeeps', () => {
  const t = segmentTimeline([60], cfg({ atSecondsRemaining: [10, 3, 2, 1] }));
  it('returns beeps in (from, to]', () => {
    expect(times(dueBeeps(t, 49.9, 57.05))).toEqual([50, 57]);
  });
  it('never returns the same beep twice across consecutive windows', () => {
    const a = dueBeeps(t, -0.001, 50);
    const b = dueBeeps(t, 50, 58);
    expect([...times(a), ...times(b)]).toEqual([50, 57, 58]);
  });
});

describe('segmentAt', () => {
  it('finds the side and the time left in it', () => {
    expect(segmentAt([30, 30], 12)).toEqual({ index: 0, remaining: 18 });
    expect(segmentAt([30, 30], 30)).toEqual({ index: 1, remaining: 30 });
    expect(segmentAt([30, 30], 61)).toEqual({ index: 1, remaining: 0 });
  });
});
