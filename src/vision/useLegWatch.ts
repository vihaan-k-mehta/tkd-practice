import { useEffect, useRef, useState } from 'preact/hooks';
import { audio, vibrate } from '../engine/audio';
import { DropWatch } from './dropwatch';
import type { Verifier } from './useVerifier';

export interface BwTotals { drops: number; penalties: number; holdPeak: number }
export const newTotals = (): BwTotals => ({ drops: 0, penalties: 0, holdPeak: 0 });

/**
 * While `leg` must stay up, watch it. If the foot has been down for 0.6 s, beep fast until it is lifted.
 * If it stays down it costs XP (counted into `totals`). `hold` also records the highest the leg got.
 */
export function useLegWatch(v: Verifier | undefined, leg: 'left' | 'right' | undefined, totals: { current: BwTotals } | undefined, hold = false) {
  const [alarm, setAlarm] = useState(false);
  const w = useRef(new DropWatch());
  useEffect(() => {
    if (!v || !leg) return;
    const watch = w.current; watch.reset();
    let lastBeep = 0, on = false;
    const id = setInterval(() => {
      const now = performance.now();
      const info = v.status === 'ready' ? v.frameRef.current?.legs[leg] ?? null : null;
      const r = watch.update(now, info ? info.planted : null, true);
      if (totals) {
        if (r.event === 'alarm') totals.current.drops++;
        if (r.event === 'penalty') totals.current.penalties++;
        if (hold && info && !info.planted) totals.current.holdPeak = Math.max(totals.current.holdPeak, info.height);
      }
      if (r.alarm !== on) { on = r.alarm; setAlarm(on); }
      if (r.alarm && now - lastBeep >= 250) { lastBeep = now; audio.play('high'); vibrate('short'); }
    }, 40);
    return () => clearInterval(id);
  }, [leg, v]);
  return alarm;
}
