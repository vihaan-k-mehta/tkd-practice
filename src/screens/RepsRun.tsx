import { useEffect, useRef, useState } from 'preact/hooks';
import { Minus, Plus, SkipForward } from 'lucide-preact';

/** Manual rep counter. Camera counting replaces the tap in the camera milestone. */
export function RepsRun({ label, reps, side, caption, next, onDone, onSkip }: {
  label: string; reps: number; side?: string; caption?: string; next?: string; onDone: (count: number, elapsedSec: number) => void; onSkip: () => void;
}) {
  const [n, setN] = useState(0);
  const t0 = useRef(performance.now()).current;
  useEffect(() => { document.body.dataset.phase = 'work'; }, []);
  return (
    <>
      <p class="eyebrow">{[side ?? 'Reps', caption?.toLowerCase()].filter(Boolean).join(', ')}</p>
      <h2 class="block-name">{label}</h2>
      <p class="clock" role="status" aria-label={`${n} of ${reps} reps`}>{n}<span class="of"> / {reps}</span></p>
      {next && <p class="sub up-next">Next: {next}</p>}
      <button class="btn-primary tap-rep" onClick={() => setN(n + 1)}><Plus size={28} aria-hidden="true" /> Count a rep</button>
      <div class="two" style={{ marginTop: '14px' }}>
        <button class="select" onClick={() => setN(Math.max(0, n - 1))} aria-label="Remove a rep"><span>Undo</span><Minus size={20} aria-hidden="true" /></button>
        <button class="select" onClick={onSkip}>Skip block<SkipForward size={20} aria-hidden="true" /></button>
      </div>
      <button class="btn-primary" style={{ marginTop: '14px', background: n >= reps ? 'var(--accent)' : 'var(--surface)', color: n >= reps ? 'var(--on-accent)' : 'var(--ink)' }} onClick={() => onDone(n, (performance.now() - t0) / 1000)}>
        {n >= reps ? 'Done' : 'Finish early'}
      </button>
    </>
  );
}
