import { useState } from 'preact/hooks';
import { Sheet, Stepper } from '../app/Sheet';
import { camera } from '../data/library';
import { exerciseById } from '../data/exercises';
import { deleteSamplesFor, forgetTuning, keepSample, newSampleId, samplesFor } from '../data/samplestore';
import { sampleFromBuffer, type Sample } from '../vision/samples';
import { tuneExercise, type Tuned } from '../vision/tuning';
import type { Verifier } from '../vision/useVerifier';

/**
 * "Tracking wrong?" Tell it what you really did in the last minute and it re-checks the recording it already holds,
 * tunes this exercise to you, and remembers it for next time. Nothing was saved until you press the button.
 */
export function TrackingHelp({ v, exerciseId, onClose }: { v: Verifier; exerciseId: string; onClose: () => void }) {
  const ex = exerciseById(exerciseId)!;
  const [reps, setReps] = useState(5);
  const [leg, setLeg] = useState<'left' | 'right' | 'both'>(ex.perSide ? 'left' : 'both');
  const [secs, setSecs] = useState(60);
  const [result, setResult] = useState<{ tuned: Tuned; sample: Sample } | null>(null);
  const [saved, setSaved] = useState(false);
  const cam = camera.use();
  const have = cam.exercise?.[exerciseId];
  const isKick = ex.verify === 'reps';

  const check = async () => {
    const r = v.recent();
    const sample = sampleFromBuffer(r.frames, { exerciseId, leg, expected: isKick ? reps : 0, seconds: secs, now: r.now, id: newSampleId(), fps: Number(r.fps.toFixed(1)), note: 'from a session' });
    setResult({ sample, tuned: tuneExercise(exerciseId, [...(await samplesFor(exerciseId)), sample]) });
    setSaved(false);
  };

  return (
    <Sheet title="Tracking wrong?" onClose={onClose}>
      <p class="sub">{ex.name}. Tell me what you really did in the last minute and I will tune the camera to you for this exercise.</p>
      {isKick && <Stepper label="Kicks you really threw" value={reps} set={setReps} min={0} max={60} />}
      {ex.perSide && (
        <div class="seg-row" role="radiogroup" aria-label="Which leg" style={{ marginTop: '10px' }}>
          {(['left', 'right', 'both'] as const).map((l) => <button class={`seg ${leg === l ? 'on' : ''}`} role="radio" aria-checked={leg === l} onClick={() => setLeg(l)}>{l === 'both' ? 'Both legs' : `${l[0].toUpperCase() + l.slice(1)} leg`}</button>)}
        </div>
      )}
      <Stepper label="Look back" unit="s" value={secs} set={setSecs} min={10} max={120} step={10} />
      <button class="btn-primary" style={{ marginTop: '14px' }} onClick={check}>Check and fix</button>

      {result && (
        <div class="cal-box" style={{ marginTop: '14px' }} role="status">
          <b>{result.tuned.ok ? 'Found a fix' : 'Could not get it exact'}</b>
          {isKick && <p class="sub">Standard settings counted {result.tuned.before.counted} of {result.tuned.before.expected}. Tuned to you: {result.tuned.after.counted} of {result.tuned.after.expected}.</p>}
          <p class="sub">{result.tuned.advice}</p>
          {!saved ? <button class="btn-primary" onClick={async () => { await keepSample(result.sample); setSaved(true); }}>Save this fix for next time</button> : <p class="sub"><b>Saved.</b> It applies from the next block of {ex.name}.</p>}
        </div>
      )}

      <p class="eyebrow">Or</p>
      <button class="btn-ghost" onClick={() => camera.set((c) => ({ ...c, exercise: { ...c.exercise, [exerciseId]: { ...(c.exercise?.[exerciseId] ?? { samples: 0 }), motionThreshold: Math.max(0.02, (c.exercise?.[exerciseId]?.motionThreshold ?? c.motionThreshold ?? 0.1) * 0.5) } } }))}>It keeps pausing me: be more forgiving here</button>
      {have && <button class="link-btn" style={{ margin: '10px auto 0' }} onClick={async () => { forgetTuning(exerciseId); await deleteSamplesFor(exerciseId); setResult(null); }}>Reset what it learned for {ex.name}</button>}
      <a class="link-btn" href="#/tuning" style={{ margin: '10px auto 0' }}>Record all my exercises (training data)</a>
    </Sheet>
  );
}
