import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Pause, Play, Plus, SkipForward } from 'lucide-preact';
import { BlockClock } from '../engine/timer';
import { dueBeeps, segmentAt, segmentTimeline, type AlertConfig, type Beep } from '../engine/alerts';
import { audio, vibrate } from '../engine/audio';
import type { Verifier } from '../vision/useVerifier';
import { useLegWatch, type BwTotals } from '../vision/useLegWatch';

const LOOKAHEAD = 0.15; // seconds scheduled ahead on the audio clock
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export interface RunProps {
  label: string;
  kind: 'ready' | 'work' | 'rest';
  segments: number[];
  sideLabels?: string[];
  caption?: string;
  cfg: AlertConfig;
  timeline?: Beep[];
  phaseChange?: boolean;
  next?: string;
  skipLabel?: string;
  onDone: (elapsedSec: number, verifiedSec?: number) => void;
  onSkip: () => void;
  /** When set, the timer only runs while the camera sees you doing the work. */
  verifier?: Verifier;
  verifyMode?: 'presence' | 'motion';
  onFail?: (elapsedSec: number, verifiedSec: number) => void;
  /** The camera stopped (for example the app went to the background). The timer holds until it is back. */
  cameraDown?: boolean;
  /** The foot must stay up on this leg. A fast beep means it touched down. */
  watchLeg?: 'left' | 'right'; hold?: boolean; totals?: { current: BwTotals };
  /** Which exercise this is, so its own tuning is used. */
  exerciseId?: string;
}

export function BlockRun({ label, kind, segments, sideLabels, caption, cfg, timeline, phaseChange, next, skipLabel, onDone, onSkip, verifier, verifyMode, onFail, cameraDown, watchLeg, hold, totals, exerciseId }: RunProps) {
  const clock = useRef(new BlockClock(segments.reduce((a, b) => a + b, 0))).current;
  const [segs, setSegs] = useState(segments);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState({ index: 0, remaining: segments[0], suspended: false });

  const tl = useMemo(() => timeline ?? segmentTimeline(segs, cfg, { phaseChange }), [segs, cfg, timeline, phaseChange]);
  const tlRef = useRef(tl); tlRef.current = tl;
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const segsRef = useRef(segs); segsRef.current = segs;
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const verifierRef = useRef(verifier); verifierRef.current = verifier;
  const failRef = useRef(onFail); failRef.current = onFail;
  const failed = useRef(false);

  useEffect(() => {
    audio.setVolume(cfgRef.current.volume);
    clock.start();
    let scheduled = -0.001;
    let finished = false;
    const id = setInterval(() => {
      const el = clock.elapsedSec();
      if (clock.running) {
        for (const b of dueBeeps(tlRef.current, scheduled, el + LOOKAHEAD)) {
          const delay = Math.max(0, b.at - el);
          audio.play(b.type, delay);
          setTimeout(() => vibrate(cfgRef.current.vibrate), delay * 1000);
        }
        scheduled = Math.max(scheduled, el + LOOKAHEAD);
      }
      const s = segmentAt(segsRef.current, el);
      setView({ index: s.index, remaining: Math.ceil(s.remaining - 1e-6), suspended: audio.state === 'suspended' });
      if (!finished && clock.isDone()) { finished = true; clearInterval(id); doneRef.current(el, verifierRef.current ? (verifierRef.current.readGate()?.verifiedMs ?? 0) / 1000 : undefined); }
    }, 40);
    return () => clearInterval(id);
  }, []);

  // Camera gate: pause the clock while you are out of view or idle, resume when detected again.
  const gate = verifier?.gate ?? null;
  const held = (!!gate && !gate.running) || !!cameraDown;
  useEffect(() => {
    if (!verifier || !verifyMode) return;
    verifier.beginBlock(verifyMode, exerciseId);
    return () => { verifier.endBlock(); };
  }, []);
  useEffect(() => {
    if (!gate) return;
    if (held) clock.pause(); else if (!paused) clock.resume();
    if (gate.state === 'failed' && !failed.current) { failed.current = true; failRef.current?.(clock.elapsedSec(), gate.verifiedMs / 1000); }
  }, [held, gate?.state, cameraDown]);

  useEffect(() => {
    const last = view.remaining <= 10 && view.index === segs.length - 1 && kind === 'work';
    document.body.dataset.phase = kind === 'ready' ? 'ready' : kind === 'rest' ? 'rest' : last ? 'last' : 'work';
  }, [view.remaining, view.index, kind, segs.length]);

  const footDown = useLegWatch(verifier, watchLeg, totals, hold);
  const toggle = () => { if (paused) { if (!held) clock.resume(); } else clock.pause(); setPaused(!paused); };
  const add10 = () => { clock.addSeconds(10); setSegs((s) => s.map((d, i) => (i === s.length - 1 ? d + 10 : d))); };
  const eyebrow = kind === 'ready' ? 'Get ready' : sideLabels?.[view.index] ?? (kind === 'rest' ? 'Rest' : 'Work');

  return (
    <>
      <p class="eyebrow">{eyebrow}{caption && kind !== 'ready' ? `, ${caption.toLowerCase()}` : ''}</p>
      <h2 class="block-name">{label}</h2>
      <p class="clock" role="timer" aria-label={`${view.remaining} seconds remaining`}>{kind === 'ready' ? view.remaining : fmt(view.remaining)}</p>
      {kind !== 'ready' && next && <p class="sub up-next">Next: {next}</p>}

      {footDown && <p class="banner gate foot" role="alert">Foot up! Lift it now or you lose XP.</p>}
      {cameraDown && verifier && <button class="banner gate" onClick={() => void verifier.start()}>The camera turned off, so your time is paused. Tap to turn it back on.</button>}
      {held && !cameraDown && gate && gate.message && <p class="banner gate" role="alert">{gate.message}</p>}
      {view.suspended && <button class="banner" onClick={() => audio.unlock()}>Tap to enable sound</button>}

      <section class="panel run-controls">
        <div class="two">
          <button class="select" onClick={toggle}>{paused ? 'Resume' : 'Pause'}{paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}</button>
          <button class="select" onClick={onSkip}>{skipLabel ?? 'Skip block'}<SkipForward size={20} aria-hidden="true" /></button>
        </div>
        {kind !== 'ready' && <button class="select" onClick={add10}>Add 10 seconds<Plus size={20} aria-hidden="true" /></button>}
      </section>
    </>
  );
}
