import { useEffect, useRef, useState } from 'preact/hooks';
import { Camera, ShieldCheck } from 'lucide-preact';
import { CameraPreview } from './CameraPreview';
import { camera } from '../data/library';
import { DEFAULT_REP_CONFIG } from '../vision/repCounter';
import { Tracker } from '../vision/tracker';
import type { Verifier } from '../vision/useVerifier';

const DETECTED_HOLD_MS = 1000;

/** Before the first checked block: privacy, permission, framing, and an optional 3-kick calibration. */
export function CameraSetup({ v, onStart, onHonor }: { v: Verifier; onStart: () => void; onHonor: () => void }) {
  const [heldMs, setHeldMs] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [calibrated, setCalibrated] = useState(false);
  const since = useRef<number | null>(null);
  const cal = useRef<Tracker | null>(null);

  // Detected must hold for 1 second before Start enables.
  useEffect(() => {
    if (v.frame?.inFrame) { since.current ??= performance.now(); setHeldMs(performance.now() - since.current); }
    else { since.current = null; setHeldMs(0); }
  }, [v.frame]);

  // Calibration: a lenient counter listens for 3 kicks and learns this person's own kick height.
  useEffect(() => {
    if (!calibrating) return;
    cal.current = new Tracker({ ...DEFAULT_REP_CONFIG, kickHeight: -0.7, kneeUp: -0.4 });
    const id = setInterval(() => {
      const lm = v.lmRef.current;
      const f = cal.current!.update(performance.now(), lm);
      if (f.newReps.length) setPeaks((p) => [...p, ...f.newReps.map((r) => r.peakHeight)].slice(0, 3));
    }, 55);
    return () => clearInterval(id);
  }, [calibrating]);
  useEffect(() => {
    if (peaks.length < 3) return;
    const lowest = Math.min(...peaks);
    camera.set((c) => ({ ...c, kickHeight: Math.max(-0.6, Math.min(0.3, lowest - 0.15)) }));
    v.tracker.current = new Tracker({ ...DEFAULT_REP_CONFIG, kickHeight: Math.max(-0.6, Math.min(0.3, lowest - 0.15)) });
    setCalibrating(false); setCalibrated(true);
  }, [peaks.length]);

  const ready = v.status === 'ready';
  return (
    <>
      <h2 class="block-name">Camera check</h2>
      <p class="sub" style={{ margin: '8px 0 12px' }}><ShieldCheck size={18} aria-hidden="true" /> Video stays on this phone. Nothing is recorded or sent.</p>

      {v.status === 'off' || v.status === 'error' ? (
        <>
          <button class="btn-primary" onClick={() => v.start()}><Camera size={22} aria-hidden="true" /> Allow camera</button>
          {v.error && <p class="sub note warn" role="alert">{v.error}</p>}
        </>
      ) : (
        <>
          <div class="frame-guide">
            <CameraPreview v={v} big />
            <svg viewBox="0 0 100 150" class="outline" aria-hidden="true"><circle cx="50" cy="20" r="9" /><path d="M50 29 V80 M50 40 L28 66 M50 40 L72 66 M50 80 L34 138 M50 80 L66 138" /></svg>
          </div>
          <p class={`sub note ${v.frame?.inFrame ? '' : 'warn'}`} role="status">{v.status === 'starting' ? 'Loading the body tracker, one moment...' : v.frame?.inFrame ? `Detected. ${heldMs >= DETECTED_HOLD_MS ? 'Ready.' : 'Hold still for a second...'}` : v.frame?.message ?? 'Step back so your whole body is in view.'}</p>
          <ul class="cues">
            <li>Prop the phone 2 to 3 metres away, at hip height.</li>
            <li>Put it to your side so your kicks go across the screen. A kick straight at the camera is hard to see.</li>
            <li>Face the light. Avoid a bright window behind you.</li>
          </ul>
          {!calibrated && !calibrating && ready && <button class="btn-ghost" onClick={() => { setPeaks([]); setCalibrating(true); }}>Optional: calibrate with 3 kicks</button>}
          {calibrating && <p class="sub note" role="status">Throw {3 - peaks.length} more kick{3 - peaks.length === 1 ? '' : 's'} at your usual height...</p>}
          {calibrated && <p class="sub note" role="status">Calibrated to your kick height.</p>}
          <button class="btn-primary" style={{ marginTop: '18px' }} disabled={!ready || !v.frame?.inFrame || heldMs < DETECTED_HOLD_MS} onClick={onStart}>Start</button>
        </>
      )}

      <button class="link-btn" style={{ margin: '18px auto 0' }} onClick={onHonor}>Continue without the camera (half XP, not on leaderboards)</button>
    </>
  );
}
