import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Pause, Play, Plus, SkipForward } from 'lucide-preact';
import { BlockClock } from '../engine/timer';
import { dueBeeps, segmentAt, segmentTimeline, type AlertConfig, type Beep } from '../engine/alerts';
import { audio, vibrate } from '../engine/audio';

const LOOKAHEAD = 0.15; // seconds scheduled ahead on the audio clock
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export interface RunProps {
  label: string;
  kind: 'ready' | 'work';
  segments: number[];
  sideLabels?: string[];
  cfg: AlertConfig;
  timeline?: Beep[];
  next?: string;
  onDone: (verifiedSec: number) => void;
  onSkip: () => void;
}

export function BlockRun({ label, kind, segments, sideLabels, cfg, timeline, next, onDone, onSkip }: RunProps) {
  const clock = useRef(new BlockClock(segments.reduce((a, b) => a + b, 0))).current;
  const [segs, setSegs] = useState(segments);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState({ index: 0, remaining: segments[0], suspended: false });

  const tl = useMemo(() => timeline ?? segmentTimeline(segs, cfg), [segs, cfg, timeline]);
  const tlRef = useRef(tl);
  tlRef.current = tl;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const segsRef = useRef(segs);
  segsRef.current = segs;

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
      if (!finished && clock.isDone()) { finished = true; clearInterval(id); onDone(el); }
    }, 40);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const last = view.remaining <= 10 && view.index === segs.length - 1 && kind === 'work';
    document.body.dataset.phase = kind === 'ready' ? 'ready' : last ? 'last' : 'work';
  }, [view.remaining, view.index, kind, segs.length]);

  const toggle = () => { if (paused) clock.resume(); else clock.pause(); setPaused(!paused); };
  const add10 = () => { clock.addSeconds(10); setSegs((s) => s.map((d, i) => (i === s.length - 1 ? d + 10 : d))); };

  return (
    <>
      <p class="eyebrow">{kind === 'ready' ? 'Get ready' : sideLabels?.[view.index] ?? 'Hold'}</p>
      <h2 class="block-name">{label}</h2>
      <p class="clock" role="timer" aria-label={`${view.remaining} seconds remaining`}>{kind === 'ready' ? view.remaining : fmt(view.remaining)}</p>
      {kind === 'work' && next && <p class="sub up-next">Next: {next}</p>}

      {view.suspended && <button class="banner" onClick={() => audio.unlock()}>Tap to enable sound</button>}

      <section class="panel run-controls">
        <div class="two">
          <button class="select" onClick={toggle}>{paused ? 'Resume' : 'Pause'}{paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}</button>
          <button class="select" onClick={onSkip}>Skip block<SkipForward size={20} aria-hidden="true" /></button>
        </div>
        {kind === 'work' && <button class="select" onClick={add10}>Add 10 seconds<Plus size={20} aria-hidden="true" /></button>}
      </section>
    </>
  );
}
