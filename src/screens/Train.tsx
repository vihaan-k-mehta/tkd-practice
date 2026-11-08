import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AlertTriangle, Camera, Check, ChevronLeft, Volume2 } from 'lucide-preact';
import { CameraPreview } from './CameraPreview';
import { camera } from '../data/library';
import { audio, vibrate } from '../engine/audio';
import { speak, speechSupported, stopSpeaking } from '../engine/speech';
import { go } from '../app/router';
import { DEFAULT_REP_CONFIG } from '../vision/repCounter';
import { Tracker } from '../vision/tracker';
import { analyze, KICKS_EACH, STEPS, type Report, type StepData, type StepId } from '../vision/training';
import { useVerifier } from '../vision/useVerifier';

const speedParam = (): number => {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '').get('speed');
  const n = q ? Number(q) : 1;
  return Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 1; // a test hook: run the script faster
};

const skipWait = (): boolean => new URLSearchParams(location.hash.split('?')[1] ?? '').get('skipwait') === '1'; // test hook

type Phase = 'intro' | 'position' | 'running' | 'report' | 'stopped';

/** A hands-free guided session. Follow the voice and beeps; it measures, tunes the camera settings, and reports back. */
export function Train() {
  const v = useVerifier();
  const speed = useMemo(speedParam, []);
  const [phase, setPhase] = useState<Phase>('intro');
  const [voice, setVoice] = useState(speechSupported());
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const [kicksSeen, setKicksSeen] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [fps, setFps] = useState(0);
  const prev = useRef(camera.get());
  const held = useRef<number | null>(null);
  const [heldMs, setHeldMs] = useState(0);
  const data = useRef<Partial<Record<StepId, StepData>>>({});
  const speedAcc = useRef({ start: 0, frames: 0 });

  const say = (text: string) => { if (voice) speak(text); };
  useEffect(() => () => stopSpeaking(), []);

  // Get in position: it begins by itself once it has seen you for a second.
  useEffect(() => {
    if (phase !== 'position') return;
    if (v.frame?.present) { held.current ??= performance.now(); setHeldMs(performance.now() - held.current); }
    else { held.current = null; setHeldMs(0); }
  }, [v.frame, phase]);
  useEffect(() => {
    if (phase === 'position' && v.status === 'ready' && heldMs >= 1000) {
      audio.play('high'); vibrate('short');
      data.current = {}; setIdx(0); setPhase('running');
    }
  }, [phase, heldMs, v.status]);

  // The camera went off in the middle of training.
  useEffect(() => { if ((phase === 'running' || phase === 'position') && v.status === 'off') { stopSpeaking(); setPhase('stopped'); } }, [v.status, phase]);

  // Run the script, one step at a time.
  useEffect(() => {
    if (phase !== 'running') return;
    const step = STEPS[idx];
    const total = (step.seconds * 1000) / speed;
    const t0 = performance.now();
    const samples: StepData['samples'] = [];
    const frames: NonNullable<StepData['frames']> = [];
    let lastFrame: unknown = null, lastTick = -1, finished = false;
    if (idx === 0) speedAcc.current = { start: performance.now(), frames: 0 };
    const lenient = step.kicks ? new Tracker({ ...DEFAULT_REP_CONFIG, kickHeight: -0.7, kneeUp: -0.4 }) : null;
    let seen = 0;
    setKicksSeen(0);
    audio.play('high'); vibrate('short'); say(step.say);

    const finish = () => {
      if (finished) return; finished = true; clearInterval(id);
      data.current[step.id] = { id: step.id, samples, frames: step.kicks ? frames : undefined };
      if (idx + 1 < STEPS.length) { audio.play('double'); setIdx(idx + 1); }
      else {
        stopSpeaking();
        const secs = Math.max(1, (performance.now() - speedAcc.current.start) / 1000);
        const rate = speedAcc.current.frames / secs; setFps(rate);
        const cs = camera.get();
        const r = analyze(data.current, { fps: rate, sensitivity: cs.sensitivity, quality: cs.quality });
        prev.current = cs;
        camera.set((c) => ({
          ...c,
          ...(r.settings.motionThreshold !== undefined ? { motionThreshold: r.settings.motionThreshold } : {}),
          ...(r.settings.kickCfg ? { kickCfg: r.settings.kickCfg, kickHeight: undefined } : {}),
          ...(r.settings.sensitivity ? { sensitivity: r.settings.sensitivity } : {}),
          ...(r.settings.quality ? { quality: r.settings.quality } : {}),
        }));
        setReport(r); setPhase('report'); audio.play(r.ok ? 'bell' : 'low'); vibrate(r.ok ? 'double' : 'short');
        if (voice) speak(r.ok ? 'Training is done. Everything looks good.' : 'Training is done. There are a few things to look at.');
      }
    };

    const id = setInterval(() => {
      const now = performance.now();
      const f = v.frameRef.current;
      if (f && f !== lastFrame) {
        lastFrame = f; speedAcc.current.frames++;
        samples.push({ present: f.present, inFrame: f.inFrame, motion: f.motion });
        if (step.kicks) {
          frames.push({ t: now, lm: v.lmRef.current });
          const ev = lenient!.update(now, v.lmRef.current).newReps.filter((r) => r.side === step.kicks);
          if (ev.length) { seen += ev.length; setKicksSeen(seen); audio.play('tick'); vibrate('short'); }
        }
      }
      const remain = Math.max(0, total - (now - t0));
      const secs = Math.ceil((remain * speed) / 1000);
      setLeft(secs);
      if (secs <= 3 && secs > 0 && secs !== lastTick && speed === 1) { lastTick = secs; audio.play('tick'); }
      if (remain <= 0 || (step.kicks && seen >= KICKS_EACH && now - t0 > 3000 / speed)) finish();
    }, 25);
    return () => { clearInterval(id); if (!finished) finished = true; };
  }, [phase, idx]);

  const begin = async () => {
    await audio.unlock(); audio.setVolume(1);
    held.current = null; setHeldMs(0); setPhase('position');
    if (voice) speak('Walk back to your spot, side on to the phone. Training starts when I can see you.');
    const ok = await v.start();
    if (ok && skipWait()) { data.current = {}; setIdx(0); setPhase('running'); }
  };

  const undo = () => { camera.set(() => prev.current); go('settings'); };
  const step = STEPS[idx];
  const done = (i: number) => i < idx || phase === 'report';

  return (
    <main class="screen">
      <header class="topbar session-top">
        <button class="icon-btn" aria-label="Back to settings" onClick={() => { stopSpeaking(); v.stop(); go('settings'); }}><ChevronLeft size={28} aria-hidden="true" /></button>
        <h3>Guided training</h3>
        <span style={{ width: '48px' }} />
      </header>

      {phase === 'intro' && (
        <>
          <p class="sub">About two minutes. Prop your phone up, then just follow the voice and the beeps. I will measure how well I can track you, tune the camera to your setup, and tell you the result.</p>
          <ul class="cues">
            <li>Prop the phone 2 to 3 metres away at hip height, with you side on to it.</li>
            <li>Face the light. Leave room to kick sideways.</li>
            <li>You will: stand still, stretch, swing your legs, kick {KICKS_EACH} times with each leg, then walk out.</li>
            <li>Video stays on this phone and is never saved. The points I measure are thrown away when you leave.</li>
          </ul>
          {speechSupported() && (
            <ul class="rowlist"><li><div class="grow"><div>Voice guidance</div><div class="sub">Reads each step out loud so you can follow from across the room.</div></div>
              <button class={`switch ${voice ? 'on' : ''}`} role="switch" aria-checked={voice} aria-label="Voice guidance" onClick={() => { setVoice(!voice); if (voice) stopSpeaking(); }}><span /></button></li></ul>
          )}
          <p class="sub note"><Volume2 size={16} aria-hidden="true" /> Turn your volume up.</p>
          <button class="btn-primary" style={{ marginTop: '16px' }} onClick={begin}><Camera size={22} aria-hidden="true" /> Start training</button>
          {v.error && <p class="sub note warn" role="alert">{v.error}</p>}
        </>
      )}

      {phase === 'position' && (
        <>
          <h2 class="block-name">Get in position</h2>
          <CameraPreview v={v} big />
          <p class={`sub note ${v.frame?.present ? '' : 'warn'}`} role="status">
            {v.status === 'starting' ? 'Loading the body tracker, one moment...' : v.frame?.present ? 'I can see you. Starting...' : 'Walk back to your spot. Training starts by itself when I can see you.'}
          </p>
          {v.error && <p class="sub note warn" role="alert">{v.error}</p>}
        </>
      )}

      {phase === 'running' && (
        <>
          <p class="eyebrow">Step {idx + 1} of {STEPS.length}</p>
          <h2 class="block-name">{step.title}</h2>
          <p class="clock" role="timer" aria-label={`${left} seconds left`}>{left}</p>
          <p class="sub" style={{ textAlign: 'center' }}>{step.say}</p>
          {step.kicks && (
            <div class="cal-dots" aria-label={`${Math.min(kicksSeen, KICKS_EACH)} of ${KICKS_EACH} kicks seen`}>
              {Array.from({ length: KICKS_EACH }, (_, i) => <span class={i < kicksSeen ? 'on' : ''}>{i < kicksSeen ? <Check size={20} aria-hidden="true" /> : i + 1}</span>)}
            </div>
          )}
          <div class="train-steps" aria-hidden="true">{STEPS.map((s, i) => <i class={done(i) ? 'done' : i === idx ? 'now' : ''} />)}</div>
          <CameraPreview v={v} />
        </>
      )}

      {phase === 'stopped' && (
        <>
          <h2 class="block-name">Training stopped</h2>
          <p class="sub note warn" role="alert">The camera turned off, so I could not finish. This can happen if you switch apps or the screen locks.</p>
          <button class="btn-primary" onClick={() => { setPhase('intro'); }}>Start again</button>
        </>
      )}

      {phase === 'report' && report && (
        <>
          <div class={`cal-box ${report.ok ? 'ok' : ''}`} role="status">
            {report.ok ? <Check size={26} aria-hidden="true" /> : <AlertTriangle size={26} aria-hidden="true" />}
            <b>{report.ok ? 'Trained' : 'Trained, with notes'}</b>
            <p class="sub">{report.summary}</p>
          </div>
          <ul class="rowlist" style={{ marginTop: '14px' }}>
            {report.rows.map((r) => (
              <li class="report-row">
                <span class={`mark ${r.status}`} aria-label={r.status === 'ok' ? 'Good' : 'Needs a look'}>{r.status === 'ok' ? <Check size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}</span>
                <span class="grow"><b>{r.label}</b><span class="sub block">{r.detail}</span>{r.advice && <span class="block warn-text">{r.advice}</span>}</span>
              </li>
            ))}
          </ul>
          <p class="eyebrow">What I saved</p>
          <ul class="rowlist">
            {report.settings.motionThreshold !== undefined && <li><span class="grow">Counts as moving above</span><b>{report.settings.motionThreshold}</b></li>}
            {report.settings.kickCfg && <li><span class="grow">Kick height and angles fitted to you</span><b>Yes</b></li>}
            {report.settings.sensitivity && <li><span class="grow">Sensitivity</span><b>{report.settings.sensitivity}</b></li>}
            {report.settings.quality && <li><span class="grow">Tracking quality</span><b>{report.settings.quality === 'lite' ? 'Fast' : 'Accurate'}</b></li>}
            {Object.keys(report.settings).length === 0 && <li><span class="sub">Nothing needed changing.</span></li>}
          </ul>
          <p class="sub note">Frames a second: about {Math.round(fps)}.</p>
          <button class="btn-primary" style={{ marginTop: '14px' }} onClick={() => go('settings')}>Done</button>
          <button class="btn-ghost" style={{ marginTop: '10px' }} onClick={() => { data.current = {}; setReport(null); setPhase('intro'); }}>Run it again</button>
          <button class="link-btn" style={{ margin: '10px auto 0' }} onClick={undo}>Undo these changes</button>
        </>
      )}
    </main>
  );
}
