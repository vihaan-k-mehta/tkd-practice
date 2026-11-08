import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronDown, Volume2 } from 'lucide-preact';
import { BlockRun } from './BlockRun';
import { useAlerts } from '../data/settings';
import { audio } from '../engine/audio';
import { keepAwake } from '../engine/wakelock';
import { segmentTimeline, type Beep } from '../engine/alerts';

// Demo routine until the routine builder (milestone 4). Stretch holds, per-side seconds.
interface Demo { name: string; perSide: number; sides: boolean }
const routine: Demo[] = [
  { name: 'Hamstring stretch', perSide: 30, sides: true },
  { name: 'Hip flexor lunge', perSide: 30, sides: true },
  { name: 'Butterfly', perSide: 45, sides: false },
];
const READY_TIMELINE: Beep[] = [
  { at: 2, kind: 'alert', type: 'tick' }, { at: 3, kind: 'alert', type: 'tick' }, { at: 4, kind: 'alert', type: 'tick' }, { at: 5, kind: 'start', type: 'high' },
];

type Step = { s: 'check' } | { s: 'ready'; i: number } | { s: 'run'; i: number } | { s: 'done' };

export function SessionScreen() {
  const cfg = useAlerts();
  const [step, setStep] = useState<Step>({ s: 'check' });
  const [tested, setTested] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [wasHidden, setWasHidden] = useState(false);
  const [verified, setVerified] = useState<number[]>([]);

  useEffect(() => keepAwake(), []);
  useEffect(() => {
    let hidden = false;
    const on = () => {
      if (document.visibilityState === 'hidden') hidden = true;
      else if (hidden) setWasHidden(true);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => {
    if (step.s === 'check' || step.s === 'done') document.body.dataset.phase = 'idle';
  }, [step.s]);
  useEffect(() => () => { delete document.body.dataset.phase; }, []);

  const total = useMemo(() => routine.reduce((a, b) => a + b.perSide * (b.sides ? 2 : 1), 0), []);
  const test = async () => { await audio.unlock(); audio.setVolume(cfg.volume); audio.play(cfg.beepType); setTimeout(() => audio.play('bell'), 700); setTested(true); };
  const advance = (i: number, sec: number) => {
    setVerified((v) => [...v, sec]);
    setStep(i + 1 < routine.length ? { s: 'ready', i: i + 1 } : { s: 'done' });
  };

  const block = step.s === 'ready' || step.s === 'run' ? routine[step.i] : null;
  const segments = block ? (block.sides ? [block.perSide, block.perSide] : [block.perSide]) : [];

  return (
    <main class="screen">
      <header class="topbar session-top">
        <a class="icon-btn" href="#/today" aria-label="Leave session" onClick={(e) => { if (step.s !== 'check' && step.s !== 'done') { e.preventDefault(); setSheet(true); } }}><ChevronDown size={28} aria-hidden="true" /></a>
        <h3>Daily stretch</h3>
        <span style={{ width: 48 }} />
      </header>

      {wasHidden && step.s !== 'done' && (
        <button class="banner" onClick={() => setWasHidden(false)}>The page was in the background, so sound may have stopped. Tap to dismiss.</button>
      )}

      {step.s === 'check' && (
        <>
          <h2 class="block-name">Check sound</h2>
          <p class="sub" style={{ margin: '8px 0 18px' }}>Turn your volume up and make sure silent mode is off.</p>
          <button class="btn-primary" onClick={test}><Volume2 size={22} aria-hidden="true" /> Play test beep</button>
          <p class="note sub">Warm up first: do a few dynamic leg swings before deep stretching.</p>
          <p class="sub note">{routine.length} blocks, about {Math.round(total / 60)} minutes.</p>
          <button class="btn-primary" style={{ marginTop: 28 }} disabled={!tested} onClick={() => setStep({ s: 'ready', i: 0 })}>Start</button>
          {!tested && <p class="sub hint">Play the test beep to continue.</p>}
        </>
      )}

      {step.s === 'ready' && block && (
        <BlockRun key={`r${step.i}`} kind="ready" label={block.name} segments={[5]} cfg={cfg} timeline={READY_TIMELINE}
          onDone={() => setStep({ s: 'run', i: step.i })} onSkip={() => setStep({ s: 'run', i: step.i })} />
      )}

      {step.s === 'run' && block && (
        <BlockRun key={`b${step.i}`} kind="work" label={block.name} segments={segments} sideLabels={block.sides ? ['Left side', 'Right side'] : undefined} cfg={cfg}
          next={routine[step.i + 1]?.name} onDone={(sec) => advance(step.i, sec)} onSkip={() => advance(step.i, 0)} />
      )}

      {step.s === 'done' && (
        <>
          <h2 class="block-name">Session complete</h2>
          <p class="sub" style={{ margin: '8px 0 18px' }}>{Math.round(verified.reduce((a, b) => a + b, 0))} seconds of holds.</p>
          <a class="btn-primary" href="#/today" style={{ textDecoration: 'none' }}>Done</a>
        </>
      )}

      {step.s !== 'check' && step.s !== 'done' && <button class="discard" onClick={() => setSheet(true)}>Quit session</button>}

      {sheet && (
        <div class="scrim" onClick={() => setSheet(false)}>
          <div class="sheet" role="dialog" aria-label="Quit session" onClick={(e) => e.stopPropagation()}>
            <div class="grab" />
            <h3>Quit this session?</h3>
            <p class="sub" style={{ textAlign: 'center', margin: '4px 0 16px' }}>Unfinished blocks will not count.</p>
            <a class="btn-primary" href="#/today" style={{ textDecoration: 'none' }}>Quit session</a>
            <button class="discard" style={{ color: 'var(--ink)', marginTop: 12 }} onClick={() => setSheet(false)}>Keep going</button>
          </div>
        </div>
      )}
    </main>
  );
}
