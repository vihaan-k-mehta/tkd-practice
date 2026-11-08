import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Check, ChevronLeft, Download, Mic } from 'lucide-preact';
import { CameraPreview } from './CameraPreview';
import { ExerciseAnim } from '../anim/ExerciseAnim';
import { camera } from '../data/library';
import { CATEGORIES, EXERCISES, exerciseById } from '../data/exercises';
import { allSamples, downloadExport, keepSample, newSampleId, samplesFor } from '../data/samplestore';
import { audio, vibrate } from '../engine/audio';
import { speak, speechSupported, stopSpeaking } from '../engine/speech';
import { go } from '../app/router';
import { DEFAULT_REP_CONFIG } from '../vision/repCounter';
import { packFrame, type Packed, type Sample } from '../vision/samples';
import { Tracker } from '../vision/tracker';
import { tuneExercise, type Tuned } from '../vision/tuning';
import { useVerifier } from '../vision/useVerifier';

const REPS = 5;
const query = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
const speedHook = () => Math.max(1, Math.min(20, Number(query().get('speed')) || 1));
const skipHook = () => query().get('skipwait') === '1';

export function Tuning({ id }: { id?: string }) {
  return id && exerciseById(id) ? <RecordExercise id={id} /> : <Table />;
}

/* ---------------- the table ---------------- */
function Table() {
  const cam = camera.use();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { void allSamples().then((all) => { const c: Record<string, number> = {}; all.forEach((s) => { c[s.exerciseId] = (c[s.exerciseId] ?? 0) + 1; }); setCounts(c); }); }, []);
  const done = EXERCISES.filter((e) => (counts[e.id] ?? 0) > 0).length;
  const next = EXERCISES.find((e) => !(counts[e.id] > 0));
  const status = (id: string) => {
    const t = cam.exercise?.[id];
    const n = counts[id] ?? 0;
    if (!n) return { text: 'Not recorded', cls: '' };
    if (t?.expected) return { text: `Counted ${t.counted ?? 0} of ${t.expected}`, cls: (t.counted ?? 0) >= t.expected ? 'ok' : 'warn' };
    return { text: `${n} recording${n > 1 ? 's' : ''}`, cls: 'ok' };
  };
  return (
    <main class="screen">
      <header class="topbar session-top">
        <button class="icon-btn" aria-label="Back to settings" onClick={() => go('settings')}><ChevronLeft size={28} aria-hidden="true" /></button>
        <h3>Training data</h3><span style={{ width: '48px' }} />
      </header>
      <p class="sub">Do about 5 of each exercise in front of the camera. It records body points only, never video, and tunes the tracking to how you do that exercise. Recordings save to your account when you are signed in.</p>
      <div class="bar" role="progressbar" aria-label="Exercises recorded" aria-valuemin={0} aria-valuemax={EXERCISES.length} aria-valuenow={done}><span style={{ width: `${(done / EXERCISES.length) * 100}%` }} /></div>
      <p class="sub note"><b>{done}</b> of {EXERCISES.length} exercises recorded.</p>
      {next && <a class="btn-primary" href={`#/tuning/${next.id}`} style={{ textDecoration: 'none', marginTop: '10px' }}><Mic size={22} aria-hidden="true" /> Record next: {next.name}</a>}
      <div class="two" style={{ marginTop: '12px' }}>
        <button class="select" onClick={async () => { await downloadExport(); setMsg('Downloaded tkd-training-data.json'); }}>Download my data<Download size={20} aria-hidden="true" /></button>
        <button class={`select ${onlyTodo ? 'on' : ''}`} aria-pressed={onlyTodo} onClick={() => setOnlyTodo(!onlyTodo)}>Only not recorded</button>
      </div>
      {msg && <p class="sub note" role="status">{msg}</p>}
      {CATEGORIES.map((c) => {
        const items = EXERCISES.filter((e) => e.category === c && (!onlyTodo || !(counts[e.id] > 0)));
        if (!items.length) return null;
        return (
          <section>
            <p class="eyebrow">{c}</p>
            <ul class="rowlist">
              {items.map((e) => { const s = status(e.id); return (
                <li>
                  <span class="grow"><b>{e.name}</b><span class={`sub block ${s.cls === 'warn' ? 'warn-text' : ''}`}>{s.cls === 'ok' && <Check size={14} aria-hidden="true" />} {s.text}</span></span>
                  <a class="link-btn" href={`#/tuning/${e.id}`} aria-label={`Record ${e.name}`}>{counts[e.id] ? 'Again' : 'Record'}</a>
                </li>
              ); })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

/* ---------------- recording one exercise ---------------- */
type Phase = 'intro' | 'position' | 'count' | 'capture' | 'review' | 'saved';
type Leg = 'left' | 'right' | 'both';

function RecordExercise({ id }: { id: string }) {
  const ex = exerciseById(id)!;
  const v = useVerifier();
  const speed = useMemo(speedHook, []);
  const legs: Leg[] = ex.perSide ? ['left', 'right'] : ['both'];
  const [legIdx, setLegIdx] = useState(0);
  const leg = legs[legIdx];
  const [phase, setPhase] = useState<Phase>('intro');
  const [voice, setVoice] = useState(speechSupported());
  const [left, setLeft] = useState(0);
  const [seen, setSeen] = useState(0);
  const [result, setResult] = useState<{ tuned: Tuned; sample: Sample } | null>(null);
  const held = useRef<number | null>(null);
  const [heldMs, setHeldMs] = useState(0);
  const finish = useRef<() => void>(() => {});
  const isKick = ex.verify === 'reps';
  const isHold = ex.blockType === 'hold';
  const expected = isHold ? 0 : REPS;
  const seconds = isKick ? 40 : isHold ? Math.min(45, (ex.defaultTarget.seconds ?? 30) + 3) : 30;
  const legWord = leg === 'both' ? '' : ` with your ${leg} leg`;
  const say = (t: string) => { if (voice) speak(t); };
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (phase !== 'position') return;
    if (v.frame?.present) { held.current ??= performance.now(); setHeldMs(performance.now() - held.current); } else { held.current = null; setHeldMs(0); }
  }, [v.frame, phase]);
  useEffect(() => { if (phase === 'position' && v.status === 'ready' && heldMs >= 1000) { audio.play('high'); setPhase('count'); } }, [phase, heldMs, v.status]);

  // 3, 2, 1
  useEffect(() => {
    if (phase !== 'count') return;
    let n = 3; setLeft(n); say(isHold ? `Hold${legWord}.` : `Do ${REPS} ${ex.name}${legWord}. Starting in 3.`);
    const t = setInterval(() => { n--; setLeft(n); if (n > 0) audio.play('tick'); if (n <= 0) { clearInterval(t); audio.play('high'); setPhase('capture'); } }, 1000 / speed);
    return () => clearInterval(t);
  }, [phase]);

  // capture
  useEffect(() => {
    if (phase !== 'capture') return;
    const frames: Packed[] = [];
    const t0 = performance.now(), total = (seconds * 1000) / speed;
    const lenient = isKick ? new Tracker({ ...DEFAULT_REP_CONFIG, kickHeight: -0.7, kneeUp: -0.4 }) : null;
    let last: unknown = null, got = 0, doneAt = 0, ended = false, n = 0;
    setSeen(0); say('Go.');
    const end = () => {
      if (ended) return; ended = true; clearInterval(timer);
      audio.play('double'); vibrate('double'); say('Stop. Thank you.');
      const secs = Math.max(1, (performance.now() - t0) / 1000);
      const sample: Sample = { id: newSampleId(), exerciseId: id, leg, expected, fps: Number((n / secs).toFixed(1)), createdAt: Date.now(), frames };
      void samplesFor(id).then((prev) => { setResult({ sample, tuned: tuneExercise(id, [...prev, sample]) }); setPhase('review'); });
    };
    finish.current = end;
    const timer = setInterval(() => {
      const now = performance.now();
      const f = v.frameRef.current;
      if (f && f !== last) {
        last = f; n++;
        frames.push(packFrame(now - t0, v.lmRef.current));
        if (lenient) {
          const ev = lenient.update(now, v.lmRef.current).newReps.filter((r) => leg === 'both' || r.side === leg);
          if (ev.length) { got += ev.length; setSeen(got); audio.play('tick'); vibrate('short'); if (got >= REPS && !doneAt) doneAt = now + 1500 / speed; }
        }
      }
      const remain = Math.max(0, total - (now - t0));
      setLeft(Math.ceil((remain * speed) / 1000));
      if (remain <= 0 || (doneAt && now >= doneAt)) end();
    }, 25);
    return () => { clearInterval(timer); ended = true; };
  }, [phase]);

  const begin = async () => {
    await audio.unlock(); audio.setVolume(1);
    held.current = null; setHeldMs(0); setPhase('position');
    say('Walk back to your spot. Recording starts when I can see you.');
    const ok = await v.start();
    if (ok && skipHook()) setPhase('count');
  };
  const keep = async () => {
    if (!result) return;
    await keepSample(result.sample);
    if (legIdx + 1 < legs.length) { setLegIdx(legIdx + 1); setResult(null); setPhase('position'); held.current = null; setHeldMs(0); say('Now the other leg.'); if (skipHook()) setPhase('count'); }
    else { setPhase('saved'); say('Saved.'); }
  };
  const nextId = () => { const i = EXERCISES.findIndex((e) => e.id === id); return EXERCISES[i + 1]?.id; };

  return (
    <main class="screen">
      <header class="topbar session-top">
        <button class="icon-btn" aria-label="Back to the table" onClick={() => { stopSpeaking(); v.stop(); go('tuning'); }}><ChevronLeft size={28} aria-hidden="true" /></button>
        <h3>{ex.name}</h3><span style={{ width: '48px' }} />
      </header>

      {phase === 'intro' && (
        <>
          <ExerciseAnim id={id} />
          <p class="sub">{isHold ? `Hold it for about ${(ex.defaultTarget.seconds ?? 30)} seconds.` : `You will do ${REPS} ${isKick ? 'kicks' : 'reps'}.`}{ex.perSide ? ' Left side first, then right.' : ''} Prop the phone 2 to 3 metres away, to your side.</p>
          <ul class="cues">{ex.cues.map((c) => <li>{c}</li>)}</ul>
          {speechSupported() && <ul class="rowlist"><li><div class="grow">Voice guidance</div><button class={`switch ${voice ? 'on' : ''}`} role="switch" aria-checked={voice} aria-label="Voice guidance" onClick={() => { setVoice(!voice); if (voice) stopSpeaking(); }}><span /></button></li></ul>}
          <button class="btn-primary" style={{ marginTop: '14px' }} onClick={begin}>Start recording</button>
          {v.error && <p class="sub note warn" role="alert">{v.error}</p>}
        </>
      )}
      {phase === 'position' && (
        <>
          <h2 class="block-name">Get in position</h2>
          <CameraPreview v={v} big />
          <p class={`sub note ${v.frame?.present ? '' : 'warn'}`} role="status">{v.status === 'starting' ? 'Loading the body tracker...' : v.frame?.present ? 'I can see you. Starting...' : 'Walk back to your spot. It starts by itself when I can see you.'}</p>
          {v.error && <p class="sub note warn" role="alert">{v.error}</p>}
        </>
      )}
      {phase === 'count' && (<><p class="eyebrow">{leg === 'both' ? 'Get ready' : `${leg[0].toUpperCase() + leg.slice(1)} leg`}</p><p class="clock" role="timer">{left}</p><p class="sub" style={{ textAlign: 'center' }}>{isHold ? 'Hold' : `${REPS} ${ex.name}`}{legWord}</p></>)}
      {phase === 'capture' && (
        <>
          <p class="eyebrow">Recording{leg === 'both' ? '' : `, ${leg} leg`}</p>
          <h2 class="block-name">{isHold ? 'Hold it' : `${REPS} ${ex.name}`}</h2>
          <p class="clock" role="timer" aria-label={`${left} seconds left`}>{left}</p>
          {isKick && <div class="cal-dots" aria-label={`${Math.min(seen, REPS)} of ${REPS} kicks seen`}>{Array.from({ length: REPS }, (_, i) => <span class={i < seen ? 'on' : ''}>{i < seen ? <Check size={20} aria-hidden="true" /> : i + 1}</span>)}</div>}
          <button class="btn-primary" style={{ marginTop: '16px' }} onClick={() => finish.current()}>I am done</button>
          <CameraPreview v={v} />
        </>
      )}
      {phase === 'review' && result && (
        <>
          <div class={`cal-box ${result.tuned.ok ? 'ok' : ''}`} role="status">
            {result.tuned.ok ? <Check size={26} aria-hidden="true" /> : null}
            <b>{result.tuned.ok ? 'Looks good' : 'Needs another look'}</b>
            <p class="sub">{result.tuned.advice}</p>
          </div>
          {isKick && <ul class="rowlist" style={{ marginTop: '12px' }}>
            <li><span class="grow">Standard settings counted</span><b>{result.tuned.before.counted} of {result.tuned.before.expected}</b></li>
            <li><span class="grow">Tuned to you counts</span><b>{result.tuned.after.counted} of {result.tuned.after.expected}</b></li>
          </ul>}
          <p class="sub note">Recorded {result.sample.frames.length} frames at about {Math.round(result.sample.fps)} a second. Body points only.</p>
          <button class="btn-primary" style={{ marginTop: '12px' }} onClick={keep}>Keep this recording</button>
          <button class="btn-ghost" style={{ marginTop: '10px' }} onClick={() => { setResult(null); setPhase('count'); }}>Record it again</button>
        </>
      )}
      {phase === 'saved' && (
        <>
          <div class="cal-box ok" role="status"><Check size={26} aria-hidden="true" /> <b>Saved</b><p class="sub">Tracking for {ex.name} is tuned to you now.</p></div>
          {nextId() && <a class="btn-primary" href={`#/tuning/${nextId()}`} style={{ textDecoration: 'none', marginTop: '14px' }}>Next: {exerciseById(nextId()!)!.name}</a>}
          <button class="btn-ghost" style={{ marginTop: '10px' }} onClick={() => { v.stop(); go('tuning'); }}>Back to the table</button>
        </>
      )}
    </main>
  );
}
