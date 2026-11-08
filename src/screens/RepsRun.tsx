import { useEffect, useRef, useState } from 'preact/hooks';
import { Minus, Plus, SkipForward } from 'lucide-preact';
import type { Verifier } from '../vision/useVerifier';
import { useLegWatch, type BwTotals } from '../vision/useLegWatch';
import { audio } from '../engine/audio';
import { KICK_SEC } from '../engine/plan';

/** Manual rep counter. Camera counting replaces the tap in the camera milestone. */
export function RepsRun({ label, reps, side, caption, next, onDone, onSkip, verifier, onFail, counts = 'camera', mode = 'presence', cameraDown, kicksPer = 1, tempo, watchLeg, totals }: {
  label: string; reps: number; side?: string; caption?: string; next?: string; onDone: (count: number, elapsedSec: number, verified?: boolean) => void; onSkip: () => void;
  /** When set, the camera counts the kicks instead of your taps. */
  verifier?: Verifier; onFail?: (elapsedSec: number) => void;
  /** 'camera': the camera counts kicks. 'tap': you count, but taps only count while the camera sees you (and sees you move, when asked). */
  counts?: 'camera' | 'tap'; mode?: 'presence' | 'motion'; cameraDown?: boolean;
  /** Combos: how many kicks make one rep, the tempo to beep at, and the leg that must stay up. */
  kicksPer?: number; tempo?: 'slow' | 'fast'; watchLeg?: 'left' | 'right'; totals?: { current: BwTotals };
}) {
  const [manual, setN] = useState(0);
  const t0 = useRef(performance.now()).current;
  const fr = verifier?.frame ?? null;
  const camN = !fr ? 0 : !side ? fr.reps.left + fr.reps.right : side.startsWith('Left') ? fr.reps.left : fr.reps.right;
  const autoCam = !!verifier && counts === 'camera';
  const target = autoCam ? reps * kicksPer : reps;
  const footDown = useLegWatch(verifier, watchLeg, totals);
  // A steady beep to kick to: slow is one every 3 seconds, fast one every 1.5 seconds per kick.
  useEffect(() => {
    if (!tempo) return;
    const id = setInterval(() => audio.play('low'), KICK_SEC[tempo] * 1000);
    return () => clearInterval(id);
  }, [tempo]);
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
    if (autoCam && n >= target) { done.current = true; onDone(n, (performance.now() - t0) / 1000, true); }
    else if (gate?.state === 'failed') { done.current = true; onFail?.((performance.now() - t0) / 1000); }
  }, [n, gate?.state]);
  useEffect(() => { document.body.dataset.phase = 'work'; }, []);
  return (
    <>
      <p class="eyebrow">{[side ?? 'Reps', caption?.toLowerCase()].filter(Boolean).join(', ')}</p>
      <h2 class="block-name">{label}</h2>
      <p class="clock" role="status" aria-label={`${n} of ${target} ${autoCam && kicksPer > 1 ? 'kicks' : 'reps'}`}>{n}<span class="of"> / {target}</span></p>
      {next && <p class="sub up-next">Next: {next}</p>}
      {footDown && <p class="banner gate foot" role="alert">Foot up! Lift it now or you lose XP.</p>}
      {autoCam && kicksPer > 1 && <p class="sub note">Every kick counts, so {reps} reps of {kicksPer} kicks is {target} kicks.</p>}
      {autoCam ? (
        <p class="sub note" role="status">The camera is counting your kicks. {gate && !gate.running && gate.message ? gate.message : 'Throw them to the side so the camera can see the leg.'}</p>
      ) : (
        <>
          <button class="btn-primary tap-rep" onClick={() => { if (cameraDown || (gate && !gate.running)) { setRefused(true); return; } setRefused(false); setN(manual + 1); }}><Plus size={28} aria-hidden="true" /> Count a rep</button>
          {verifier && cameraDown && <button class="banner gate" onClick={() => void verifier.start()}>The camera turned off. Tap to turn it back on.</button>}
          {verifier && !cameraDown && <p class="sub note" role="status">{gate && !gate.running ? gate.message || 'The camera is checking you.' : mode === 'motion' ? 'The camera is watching that you keep moving.' : 'The camera is checking you are in view.'}{refused ? ' That rep was not counted.' : ''}</p>}
        </>
      )}
      <div class="two" style={{ marginTop: '14px' }}>
        {!autoCam && <button class="select" onClick={() => setN(Math.max(0, manual - 1))} aria-label="Remove a rep"><span>Undo</span><Minus size={20} aria-hidden="true" /></button>}
        <button class="select" onClick={onSkip}>Skip block<SkipForward size={20} aria-hidden="true" /></button>
      </div>
      <button class="btn-primary" style={{ marginTop: '14px', background: n >= target ? 'var(--accent)' : 'var(--surface)', color: n >= target ? 'var(--on-accent)' : 'var(--ink)' }} onClick={() => { done.current = true; onDone(n, (performance.now() - t0) / 1000, !!verifier); }}>
        {n >= target ? 'Done' : 'Finish early'}
      </button>
    </>
  );
}
