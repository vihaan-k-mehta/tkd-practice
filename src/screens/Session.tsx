import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ChevronDown, Volume2 } from 'lucide-preact';
import { BlockRun } from './BlockRun';
import { RepsRun } from './RepsRun';
import { Sheet } from '../app/Sheet';
import { ExerciseAnim } from '../anim/ExerciseAnim';
import { TimeSheet } from '../app/TimeSheet';
import { CameraPreview } from './CameraPreview';
import { CameraSetup } from './CameraSetup';
import { useVerifier } from '../vision/useVerifier';
import { useAlerts } from '../data/settings';
import { audio } from '../engine/audio';
import { keepAwake } from '../engine/wakelock';
import { exerciseById } from '../data/exercises';
import { camera, equipment, getRoutine, history, lastRoutine, localDate, progress, schedule, uid, userRoutines, type SessionRecord } from '../data/library';
import { applyEvents, awardSession, quitEvents } from '../engine/quests';
import { blockFor } from '../data/templates';
import { expandBlock, routineMinutes, stepSeconds, warmupReminderIndexes, READY_SEC } from '../engine/plan';
import type { Beep } from '../engine/alerts';
import { go } from '../app/router';

const READY_TIMELINE: Beep[] = [
  { at: 2, kind: 'alert', type: 'tick' }, { at: 3, kind: 'alert', type: 'tick' }, { at: 4, kind: 'alert', type: 'tick' }, { at: 5, kind: 'start', type: 'high' },
];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

type Step = { s: 'check' } | { s: 'camera' } | { s: 'ready'; bi: number } | { s: 'run'; bi: number; si: number } | { s: 'done' };
interface Result { actualSec: number; completed: boolean; left: number; right: number; any: number; hurt?: boolean; verifiedSec?: number; camFailed?: boolean }
const blank = (): Result => ({ actualSec: 0, completed: false, left: 0, right: 0, any: 0 });

export function SessionScreen({ id }: { id?: string }) {
  const cfg = useAlerts();
  const mine = userRoutines.use();
  const base = useMemo(() => (id ? getRoutine(id, mine) : undefined), [id]);
  // A strict-mode make-up round is added once, when the session opens.
  const makeUp = useMemo(() => progress.get().makeUp > 0, [id]);
  const routine = useMemo(() => {
    if (!base || !makeUp) return base;
    const extra = equipment.get().heavyBag
      ? blockFor('bag-roundhouse', { rounds: 1, workSec: 180, restSec: 0 })
      : blockFor('roundhouse', { reps: 20, rounds: 1, restSec: 0 });
    return { ...base, blocks: [...base.blocks, extra] };
  }, [base, makeUp]);
  const [xpGain, setXpGain] = useState(0);
  const ver = useVerifier();
  const camSet = camera.use();
  const [honorNow, setHonorNow] = useState(false);
  const usedCam = useRef(false);
  const [step, setStep] = useState<Step>({ s: 'check' });
  const [tested, setTested] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [wasHidden, setWasHidden] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const saved = useRef(false);

  const plan = useMemo(() => (routine ? routine.blocks.map((b) => expandBlock(b, exerciseById(b.exerciseId)!)) : []), [routine]);
  const reminders = useMemo(() => (routine ? warmupReminderIndexes(routine) : new Set<number>()), [routine]);

  useEffect(() => keepAwake(), []);
  useEffect(() => {
    let hidden = false;
    const on = () => { if (document.visibilityState === 'hidden') hidden = true; else if (hidden) setWasHidden(true); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => { if (step.s === 'check' || step.s === 'done') document.body.dataset.phase = 'idle'; }, [step.s]);
  useEffect(() => () => { delete document.body.dataset.phase; }, []);

  const n = routine?.blocks.length ?? 0;
  const hasVerify = !!routine && routine.blocks.some((b) => exerciseById(b.exerciseId)!.verify !== 'none');
  const wantCam = hasVerify && camSet.use && !camSet.honor && !honorNow;
  const camActive = wantCam && ver.status === 'ready';
  useEffect(() => { if (step.s === 'done') ver.stop(); }, [step.s]);
  const bump = (bi: number, fn: (r: Result) => Result) => setResults((rs) => { const c = [...rs]; c[bi] = fn(c[bi] ?? blank()); return c; });
  const nextBlock = (bi: number) => setStep(bi + 1 < n ? { s: 'ready', bi: bi + 1 } : { s: 'done' });

  useEffect(() => {
    if (step.s !== 'done' || saved.current || !routine) return;
    saved.current = true;
    const rec: SessionRecord = {
      id: uid(), date: localDate(), routineId: routine.baseId ?? routine.id, routineName: routine.name,
      unverified: hasVerify && !usedCam.current ? true : undefined,
      totalSec: Math.round(results.reduce((a, r) => a + (r?.actualSec ?? 0), 0)),
      blocks: routine.blocks.map((b, i) => {
        const ex = exerciseById(b.exerciseId)!; const r = results[i] ?? blank();
        return { exerciseId: b.exerciseId, name: ex.name, plannedSec: plan[i].reduce((a, s) => a + stepSeconds(s), 0), actualSec: Math.round(r.actualSec), completed: r.completed, verifiedSec: r.verifiedSec === undefined ? undefined : Math.round(r.verifiedSec),
          reps: ex.blockType === 'reps' ? { left: r.left, right: r.right, any: r.any } : undefined, hurt: r.hurt };
      }),
    };
    history.set((h) => [rec, ...h]);
    lastRoutine.set(() => ({ id: routine.baseId ?? routine.id }));
    const ev = awardSession(progress.get(), rec, { schedule: schedule.get(), history: history.get(), today: localDate() });
    progress.set((pr) => applyEvents(pr, ev));
    setXpGain(ev.reduce((a, e) => a + (e.type === 'xp' ? e.delta : 0), 0));
  }, [step.s]);

  if (!routine) {
    return <main class="screen"><p class="empty">That routine was not found.</p><a class="btn-primary" href="#/routines" style={{ textDecoration: 'none', marginTop: '20px' }}>Back to routines</a></main>;
  }

  const test = async () => { await audio.unlock(); audio.setVolume(cfg.volume); audio.play(cfg.beepType); setTimeout(() => audio.play('bell'), 700); setTested(true); };
  const exOf = (bi: number) => exerciseById(routine.blocks[bi].exerciseId)!;
  const hurt = (bi: number) => { bump(bi, (r) => ({ ...r, hurt: true })); nextBlock(bi); };

  const nextLabel = (bi: number, si: number): string | undefined => {
    const nx = plan[bi][si + 1];
    if (nx) return nx.type === 'timed' && nx.phase === 'rest' ? 'Rest' : nx.type === 'reps' ? `${exOf(bi).name}${nx.side ? `, ${nx.side.toLowerCase()}` : ''}` : exOf(bi).name;
    return bi + 1 < n ? exOf(bi + 1).name : undefined;
  };

  const runStep = () => {
    if (step.s !== 'run') return null;
    const { bi, si } = step;
    const st = plan[bi][si];
    const ex = exOf(bi);
    const finishStep = (sec: number, reps?: number, side?: string, verifiedSec?: number) => {
      if (verifiedSec !== undefined) usedCam.current = true;
      bump(bi, (r) => ({ ...r, actualSec: r.actualSec + sec, verifiedSec: verifiedSec === undefined ? r.verifiedSec : (r.verifiedSec ?? 0) + verifiedSec, left: r.left + (side?.startsWith('Left') ? reps ?? 0 : 0), right: r.right + (side?.startsWith('Right') ? reps ?? 0 : 0), any: r.any + (reps && !side ? reps : 0) }));
      if (si + 1 < plan[bi].length) setStep({ s: 'run', bi, si: si + 1 });
      else { bump(bi, (r) => ({ ...r, completed: true })); nextBlock(bi); }
    };
    const skipBlock = () => nextBlock(bi);
    // The camera could not see you for too long, so this block does not count.
    const failBlock = (sec: number, verified = 0) => { usedCam.current = true; bump(bi, (r) => ({ ...r, actualSec: r.actualSec + sec, verifiedSec: (r.verifiedSec ?? 0) + verified, camFailed: true })); nextBlock(bi); };
    const watched = camActive && ex.verify !== 'none';
    if (st.type === 'reps') {
      return <RepsRun key={`${bi}-${si}`} label={ex.name} reps={st.reps} side={st.side} caption={st.caption} next={nextLabel(bi, si)}
        verifier={watched && ex.verify === 'reps' ? ver : undefined} onFail={(sec) => failBlock(sec)}
        onDone={(c, sec, verified) => finishStep(sec, c, st.side, verified ? sec : undefined)} onSkip={skipBlock} />;
    }
    const prev = plan[bi][si - 1];
    return (
      <BlockRun key={`${bi}-${si}`} kind={st.phase} label={ex.name} segments={st.segments} sideLabels={st.sideLabels} caption={st.caption} cfg={cfg}
        phaseChange={st.phase === 'work' && prev?.type === 'timed' && prev.phase === 'rest'} next={nextLabel(bi, si)}
        skipLabel={st.phase === 'rest' ? 'Skip rest' : 'Skip block'}
        verifier={watched && st.phase === 'work' ? ver : undefined} verifyMode={ex.verify === 'motion' ? 'motion' : 'presence'} onFail={failBlock}
        onDone={(sec, vsec) => finishStep(sec, undefined, undefined, vsec)} onSkip={st.phase === 'rest' ? () => finishStep(0) : skipBlock} />
    );
  };

  const doneCount = results.filter((r) => r?.completed).length;
  const totalActual = results.reduce((a, r) => a + (r?.actualSec ?? 0), 0);
  const anyHurt = results.some((r) => r?.hurt);
  const inRun = step.s === 'ready' || step.s === 'run';

  return (
    <main class="screen">
      <header class="topbar session-top">
        <button class="icon-btn" aria-label="Leave session" onClick={() => (step.s === 'check' || step.s === 'done' ? go('today') : setSheet(true))}><ChevronDown size={28} aria-hidden="true" /></button>
        <h3>{routine.name}</h3>
        <span style={{ width: '48px' }} />
      </header>

      {wasHidden && step.s !== 'done' && (
        <button class="banner" onClick={() => setWasHidden(false)}>The page was in the background, so sound may have stopped. Tap to dismiss.</button>
      )}

      {step.s === 'check' && (
        <>
          <h2 class="block-name">Check sound</h2>
          <p class="sub" style={{ margin: '8px 0 18px' }}>Turn your volume up and make sure silent mode is off.</p>
          <button class="btn-primary" onClick={test}><Volume2 size={22} aria-hidden="true" /> Play test beep</button>
          <p class="sub note">{n} blocks, about {routineMinutes(routine)} minutes.</p>
          {makeUp && <p class="sub note warn">Strict mode added a make-up round at the end of this session.</p>}
          {hasVerify && <p class="sub note">{wantCam ? 'Some blocks use the camera to check you are really doing the work.' : 'Camera check is off, so this session will be marked unverified and earns half XP.'}</p>}
          {reminders.size > 0 && <p class="sub note warn">This routine stretches before a dynamic warm-up. Do a few leg swings first.</p>}
          <button class="btn-primary" style={{ marginTop: '28px' }} disabled={!tested || n === 0} onClick={() => setStep(wantCam && ver.status !== 'ready' ? { s: 'camera' } : { s: 'ready', bi: 0 })}>Start</button>
          {!tested && <p class="sub hint">Play the test beep to continue.</p>}
          <button class="link-btn" style={{ margin: '16px auto 0' }} onClick={() => setTimeOpen(true)}>Short on time?</button>
          {timeOpen && <TimeSheet routine={routine} onClose={() => setTimeOpen(false)} />}
        </>
      )}

      {step.s === 'camera' && (
        <CameraSetup v={ver} onStart={() => setStep({ s: 'ready', bi: 0 })} onHonor={() => { ver.stop(); setHonorNow(true); setStep({ s: 'ready', bi: 0 }); }} />
      )}

      {step.s === 'ready' && (
        <>
          <BlockRun key={`r${step.bi}`} kind="ready" label={exOf(step.bi).name} segments={[READY_SEC]} cfg={cfg} timeline={READY_TIMELINE}
            skipLabel="Skip countdown" onDone={() => setStep({ s: 'run', bi: step.bi, si: 0 })} onSkip={() => setStep({ s: 'run', bi: step.bi, si: 0 })} />
          {reminders.has(step.bi) && <p class="sub note warn">Warm up before deep stretching. Do a few leg swings first.</p>}
          <ExerciseAnim id={exOf(step.bi).id} size="small" />
          <ul class="cues">{exOf(step.bi).cues.map((c) => <li>{c}</li>)}</ul>
        </>
      )}

      {step.s === 'run' && runStep()}

      {step.s === 'done' && (
        <>
          <h2 class="block-name">Session complete</h2>
          <div class="tiles" style={{ marginTop: '18px' }}>
            <div class="tile"><b>{mmss(totalActual)}</b><span>Time</span></div>
            <div class="tile"><b class="good-text">{doneCount} of {n}</b><span>Blocks done</span></div>
          </div>
          <div class="tiles" style={{ marginTop: '14px' }}>
            <div class="tile"><b>+{xpGain}</b><span>XP earned</span></div>
          </div>
          <ul class="rowlist" style={{ marginTop: '18px' }}>
            {routine.blocks.map((b, i) => {
              const r = results[i] ?? blank(); const ex = exOf(i);
              return (
                <li>
                  <span class="grow"><b>{ex.name}</b>
                    <span class="sub block">{r.completed ? 'Done' : r.hurt ? 'Stopped, something hurt' : r.camFailed ? 'Not completed, the camera could not see you' : 'Skipped'}{r.verifiedSec !== undefined ? `, ${mmss(r.verifiedSec)} verified` : ''}{ex.blockType === 'reps' && r.completed ? `, ${r.left + r.right + r.any} reps` : ''}</span>
                  </span>
                  <b>{mmss(r.actualSec)}</b>
                </li>
              );
            })}
          </ul>
          {anyHurt && <p class="sub note warn">Rest and skip weighted work until the pain is gone.</p>}
          <button class="btn-primary" style={{ marginTop: '24px' }} onClick={() => go('today')}>Done</button>
        </>
      )}

      {step.s !== 'camera' && ver.status !== 'off' && <CameraPreview v={ver} />}
      {inRun && step.s === 'run' && <button class="discard hurt" onClick={() => hurt(step.bi)}>Something hurt</button>}
      {inRun && <button class="discard" onClick={() => setSheet(true)}>Quit session</button>}

      {sheet && (
        <Sheet title="Quit this session?" onClose={() => setSheet(false)}>
          <p class="sub" style={{ textAlign: 'center', margin: '4px 0 16px' }}>Unfinished blocks will not count.{progress.get().mode === 'strict' ? ' In strict mode, quitting early also forfeits today\'s daily quest.' : ''}</p>
          <button class="btn-primary" onClick={() => { progress.set((pr) => applyEvents(pr, quitEvents(pr, localDate(), { schedule: schedule.get(), history: history.get(), today: localDate() }))); go('today'); }}>Quit session</button>
          <button class="discard" style={{ color: 'var(--ink)', marginTop: '12px' }} onClick={() => setSheet(false)}>Keep going</button>
        </Sheet>
      )}
    </main>
  );
}
