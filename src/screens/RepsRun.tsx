import { useEffect, useRef, useState } from 'preact/hooks';
import { Minus, Plus, SkipForward } from 'lucide-preact';
import type { Verifier } from '../vision/useVerifier';

/** Manual rep counter. Camera counting replaces the tap in the camera milestone. */
export function RepsRun({ label, reps, side, caption, next, onDone, onSkip, verifier, onFail, counts = 'camera', mode = 'presence' }: {
  label: string; reps: number; side?: string; caption?: string; next?: string; onDone: (count: number, elapsedSec: number, verified?: boolean) => void; onSkip: () => void;
  /** When set, the camera counts the kicks instead of your taps. */
  verifier?: Verifier; onFail?: (elapsedSec: number) => void;
  /** 'camera': the camera counts kicks. 'tap': you count, but taps only count while the camera sees you (and sees you move, when asked). */
  counts?: 'camera' | 'tap'; mode?: 'presence' | 'motion';
}) {
  const [manual, setN] = useState(0);
  const t0 = useRef(performance.now()).current;
  const fr = verifier?.frame ?? null;
  const camN = !fr ? 0 : !side ? fr.reps.left + fr.reps.right : side.startsWith('Left') ? fr.reps.left : fr.reps.right;
  const autoCam = !!verifier && counts === 'camera';
  const n = autoCam ? camN : manual;
  const [refused, setRefused] = useState(false);
  const gate = verifier?.gate ?? null;
  const done = useRef(false);
  useEffect(() => {
    if (!verifier) return;
    verifier.beginBlock(mode);
    return () => { verifier.endBlock(); };
  }, []);
  useEffect(() => {
    if (!verifier || done.current) return;
    if (autoCam && n >= reps) { done.current = true; onDone(n, (performance.now() - t0) / 1000, true); }
    else if (gate?.state === 'failed') { done.current = true; onFail?.((performance.now() - t0) / 1000); }
  }, [n, gate?.state]);
  useEffect(() => { document.body.dataset.phase = 'work'; }, []);
  return (
    <>
      <p class="eyebrow">{[side ?? 'Reps', caption?.toLowerCase()].filter(Boolean).join(', ')}</p>
      <h2 class="block-name">{label}</h2>
      <p class="clock" role="status" aria-label={`${n} of ${reps} reps`}>{n}<span class="of"> / {reps}</span></p>
      {next && <p class="sub up-next">Next: {next}</p>}
      {autoCam ? (
        <p class="sub note" role="status">The camera is counting your kicks. {gate && !gate.running && gate.message ? gate.message : 'Throw them to the side so the camera can see the leg.'}</p>
      ) : (
        <>
          <button class="btn-primary tap-rep" onClick={() => { if (gate && !gate.running) { setRefused(true); return; } setRefused(false); setN(manual + 1); }}><Plus size={28} aria-hidden="true" /> Count a rep</button>
          {verifier && <p class="sub note" role="status">{gate && !gate.running ? gate.message || 'The camera is checking you.' : mode === 'motion' ? 'The camera is watching that you keep moving.' : 'The camera is checking you are in view.'}{refused ? ' That rep was not counted.' : ''}</p>}
        </>
      )}
      <div class="two" style={{ marginTop: '14px' }}>
        {!autoCam && <button class="select" onClick={() => setN(Math.max(0, manual - 1))} aria-label="Remove a rep"><span>Undo</span><Minus size={20} aria-hidden="true" /></button>}
        <button class="select" onClick={onSkip}>Skip block<SkipForward size={20} aria-hidden="true" /></button>
      </div>
      <button class="btn-primary" style={{ marginTop: '14px', background: n >= reps ? 'var(--accent)' : 'var(--surface)', color: n >= reps ? 'var(--on-accent)' : 'var(--ink)' }} onClick={() => { done.current = true; onDone(n, (performance.now() - t0) / 1000, !!verifier); }}>
        {n >= reps ? 'Done' : 'Finish early'}
      </button>
    </>
  );
}
