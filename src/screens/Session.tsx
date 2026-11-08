import { useEffect, useState } from 'preact/hooks';
import { ChevronDown, Pause, Play, Plus, SkipForward } from 'lucide-preact';

// Layout preview only: a clock-based countdown with no beeps yet (milestone 3 adds the real engine).
const blocks = [
  { name: 'Dynamic warm-up', sec: 300, kind: 'work' },
  { name: 'Chamber drill', sec: 180, kind: 'work' },
  { name: 'Bill Wallace kicks', sec: 240, kind: 'work' },
];
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function SessionScreen() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    const t = setInterval(() => {
      const n = performance.now();
      setElapsedMs((e) => e + (n - last));
      last = n;
    }, 200);
    return () => clearInterval(t);
  }, [paused]);

  const b = blocks[idx];
  const remaining = Math.max(0, Math.ceil(b.sec - elapsedMs / 1000));
  const next = blocks[idx + 1];
  const skip = () => { if (next) { setIdx(idx + 1); setElapsedMs(0); } };

  return (
    <main class="screen">
      <header class="topbar session-top">
        <a class="icon-btn" href="#/today" aria-label="Minimise"><ChevronDown size={28} aria-hidden="true" /></a>
        <h3>Active session</h3>
        <button class="link-btn" onClick={() => setSheet(true)}>Finish</button>
      </header>

      <p class="eyebrow">{b.name}</p>
      <p class="clock" role="timer" aria-label={`${remaining} seconds remaining`}>{fmt(remaining)}</p>

      <div class="tiles">
        <div class="tile"><b>{idx + 1}</b><span>Block of {blocks.length}</span></div>
        <div class="tile"><b class="good-text">{fmt(Math.floor(elapsedMs / 1000))}</b><span>Verified</span></div>
      </div>

      <div class="seg-row">
        <span class="sub">Next</span>
        <span class="seg on" style={{ flex: 'none' }}>{next ? next.name : 'Cool-down'}</span>
      </div>

      <p class="eyebrow">Controls</p>
      <section class="panel">
        <div class="two">
          <button class="select" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}{paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}</button>
          <button class="select" onClick={skip}>Skip block<SkipForward size={20} aria-hidden="true" /></button>
        </div>
        <button class="select" onClick={() => setElapsedMs((e) => e - 10000)}>Add 10 seconds<Plus size={20} aria-hidden="true" /></button>
      </section>

      <button class="discard" onClick={() => setSheet(true)}>Quit session</button>

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
