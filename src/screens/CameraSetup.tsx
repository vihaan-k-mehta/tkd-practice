import { useEffect, useRef, useState } from 'preact/hooks';
import { Camera, Check, ShieldCheck } from 'lucide-preact';
import { CameraPreview } from './CameraPreview';
import { camera } from '../data/library';
import { audio, vibrate } from '../engine/audio';
import { wakeLockSupported } from '../engine/wakelock';
import { DEFAULT_REP_CONFIG } from '../vision/repCounter';
import { Tracker } from '../vision/tracker';
import { learnFromSamples, type Learned } from '../vision/profiles';
import type { Verifier } from '../vision/useVerifier';

const DETECTED_HOLD_MS = 1000;
const CAL_KICKS = 3;
const CAL_GIVE_UP_MS = 45000;
const CAL_HINT_MS = 12000;
const TRAIN_MS = 10000;

/**
 * Before the first checked block: privacy, permission, framing and an optional 3-kick calibration.
 * Press Start from anywhere: it waits until you are in frame, then begins on its own.
 */
export function CameraSetup({ v, onStart, onHonor }: { v: Verifier; onStart: () => void; onHonor: () => void }) {
  const [heldMs, setHeldMs] = useState(0);
  const [armed, setArmed] = useState(false);
  const [cal, setCal] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [peaks, setPeaks] = useState<number[]>([]);
  const [calSec, setCalSec] = useState(0);
  const [train, setTrain] = useState<'idle' | 'running'>('idle');
  const [trainLeft, setTrainLeft] = useState(0);
  const [learned, setLearned] = useState<Learned | null>(null);
  const since = useRef<number | null>(null);
  const started = useRef(false);

  // "Detected" must hold for a second before anything starts.
  useEffect(() => {
    if (v.frame?.present) { since.current ??= performance.now(); setHeldMs(performance.now() - since.current); }
    else { since.current = null; setHeldMs(0); }
  }, [v.frame]);

  const ready = v.status === 'ready';
  const steady = ready && !!v.frame?.present && heldMs >= DETECTED_HOLD_MS;

  // Start was pressed earlier: begin by itself as soon as you are in frame.
  useEffect(() => {
    if (armed && steady && cal !== 'running' && !started.current) {
      started.current = true;
      audio.play('high'); vibrate('short');
      onStart();
    }
  }, [armed, steady, cal]);

  // Calibration: a lenient counter listens for 3 kicks and learns this person's own kick height.
  useEffect(() => {
    if (cal !== 'running') return;
    const tr = new Tracker({ ...DEFAULT_REP_CONFIG, kickHeight: -0.7, kneeUp: -0.4 });
    const t0 = performance.now();
    let got = 0; const heights: number[] = [];
    const id = setInterval(() => {
      const now = performance.now();
      setCalSec(Math.round((now - t0) / 1000));
      const f = tr.update(now, v.lmRef.current);
      for (const r of f.newReps) {
        if (got >= CAL_KICKS) break;
        got++; heights.push(r.peakHeight); setPeaks([...heights]);
        audio.play('tick'); vibrate('short');
      }
      if (got >= CAL_KICKS) {
        clearInterval(id);
        const kh = Math.max(-0.6, Math.min(0.3, Math.min(...heights) - 0.15));
        camera.set((c) => ({ ...c, kickHeight: kh }));
        v.tracker.current = new Tracker({ ...DEFAULT_REP_CONFIG, kickHeight: kh });
        audio.play('bell'); vibrate('double');
        setCal('done');
      } else if (now - t0 > CAL_GIVE_UP_MS) { clearInterval(id); setCal('failed'); }
    }, 55);
    return () => clearInterval(id);
  }, [cal === 'running']);

  // Training: watch you do your normal exercise for 10 seconds and fit the settings to you.
  useEffect(() => {
    if (train !== 'running') return;
    const samples: { present: boolean; motion: number }[] = [];
    const t0 = performance.now();
    const id = setInterval(() => {
      const f = v.frameRef.current;
      samples.push({ present: !!f?.present, motion: f?.motion ?? 0 });
      const left = Math.max(0, TRAIN_MS - (performance.now() - t0));
      setTrainLeft(Math.ceil(left / 1000));
      if (left <= 0) {
        clearInterval(id);
        const r = learnFromSamples(samples);
        setLearned(r); setTrain('idle');
        if (r.ok) camera.set((c) => ({ ...c, motionThreshold: r.moveThreshold }));
        audio.play(r.ok ? 'bell' : 'low'); vibrate(r.ok ? 'double' : 'short');
      }
    }, 100);
    return () => clearInterval(id);
  }, [train]);

  const begin = () => {
    if (steady) { started.current = true; audio.play('high'); vibrate('short'); onStart(); }
    else setArmed(true);
  };

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
          <p class={`sub note ${v.frame?.present ? '' : 'warn'}`} role="status">
            {v.status === 'starting' ? 'Loading the body tracker, one moment...'
              : armed && !steady ? 'Get into position. It starts by itself when it sees you.'
              : v.frame?.present ? `Detected. ${heldMs >= DETECTED_HOLD_MS ? 'Ready.' : 'Hold still for a second...'}`
              : v.frame?.message ?? 'I cannot see you. Step back a little or into the light.'}
            {v.frame?.present && !v.frame.inFrame ? ' I can see you, but not all of you. That is fine for stretches. Kick counting needs your legs in view.' : ''}
          </p>

          <ul class="cues">
            <li>Prop the phone 2 to 3 metres away, at hip height.</li>
            <li>Put it to your side so your kicks go across the screen. A kick straight at the camera is hard to see.</li>
            <li>Face the light. Avoid a bright window behind you.</li>
            <li>The screen stays on while you train, so keep the phone plugged in. The camera uses battery.</li>
            {!wakeLockSupported() && <li><b>This browser cannot keep the screen on by itself.</b> Set Auto-Lock to Never while you train, or the camera will stop.</li>}
          </ul>

          {train === 'idle' && ready && <button class="btn-ghost" onClick={() => { setLearned(null); setTrainLeft(Math.ceil(TRAIN_MS / 1000)); setTrain('running'); }}>Train it to my setup (10 seconds)</button>}
          {train === 'running' && <div class="cal-box" role="status" aria-live="polite"><b>Do your normal exercise now</b><p class="sub">Stretch, swing your legs or kick as you usually would. {trainLeft} s left.</p></div>}
          {learned && <div class={`cal-box ${learned.ok ? 'ok' : ''}`} role="status">{learned.ok ? <Check size={26} aria-hidden="true" /> : null} <b>{learned.ok ? 'Trained to your setup' : 'Could not train'}</b><p class="sub">Seen in {Math.round(learned.presentRate * 100)} percent of the time. {learned.advice}</p></div>}

          {cal === 'idle' && ready && <button class="btn-ghost" onClick={() => { setPeaks([]); setCalSec(0); setCal('running'); }}>Optional: calibrate with 3 kicks</button>}
          {cal === 'running' && (
            <div class="cal-box" role="status" aria-live="polite">
              <b>Throw 3 kicks at your usual height</b>
              <div class="cal-dots" aria-label={`${peaks.length} of ${CAL_KICKS} kicks seen`}>
                {Array.from({ length: CAL_KICKS }, (_, i) => <span class={i < peaks.length ? 'on' : ''}>{i < peaks.length ? <Check size={20} aria-hidden="true" /> : i + 1}</span>)}
              </div>
              <p class="sub">{peaks.length} of {CAL_KICKS} seen. You will hear a tick for each one.</p>
              {calSec * 1000 > CAL_HINT_MS && peaks.length === 0 && <p class="sub warn">Not seeing a kick yet. Make sure your whole leg is in view and kick to the side.</p>}
              <button class="link-btn" onClick={() => setCal('idle')}>Cancel calibration</button>
            </div>
          )}
          {cal === 'done' && <div class="cal-box ok" role="status"><Check size={26} aria-hidden="true" /> <b>Calibrated</b><p class="sub">Your kick height is saved. You can reset it in Settings.</p></div>}
          {cal === 'failed' && (
            <div class="cal-box" role="alert"><b>Could not calibrate</b><p class="sub">It did not see three kicks. The default height will be used.</p>
              <button class="link-btn" onClick={() => { setPeaks([]); setCal('running'); }}>Try again</button></div>
          )}

          {armed ? (
            <button class="btn-ghost" style={{ marginTop: '18px' }} onClick={() => setArmed(false)}>Waiting for you to get in frame. Tap to cancel.</button>
          ) : (
            <button class="btn-primary" style={{ marginTop: '18px' }} disabled={!ready || cal === 'running'} onClick={begin}>
              {steady ? 'Start' : 'Start when I am in frame'}
            </button>
          )}
          {!armed && !steady && ready && <p class="sub hint">Tap it now, then walk back. It starts by itself when it sees you.</p>}
        </>
      )}

      <a class="link-btn" href="#/train" style={{ margin: '14px auto 0' }}>Tracking not working well? Run the guided training</a>
      <button class="link-btn" style={{ margin: '8px auto 0' }} onClick={onHonor}>Continue without the camera (half XP, not on leaderboards)</button>
    </>
  );
}
