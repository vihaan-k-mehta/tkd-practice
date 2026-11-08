import { useMemo, useState } from 'preact/hooks';
import { Sheet, Stepper } from './Sheet';
import { go } from './router';
import { quickRoutine } from '../data/library';
import type { Routine } from '../data/types';
import { fitRoutine } from '../engine/fit';
import { routineMinutes } from '../engine/plan';

const CHOICES = [5, 10, 15, 20, 30, 45];

/** Asks how many minutes someone has and starts a version of the routine that fits. */
export function TimeSheet({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const full = routineMinutes(routine.baseId ? { ...routine, id: routine.id } : routine);
  const [minutes, setMinutes] = useState(Math.min(10, Math.max(5, full)));
  const fit = useMemo(() => fitRoutine(routine, minutes), [routine, minutes]);
  const start = () => {
    if (fit.changed) quickRoutine.set(() => ({ routine: fit.routine }));
    go(`session/${fit.routine.id}`);
  };
  return (
    <Sheet title="How much time do you have?" onClose={onClose}>
      <div class="seg-row" style={{ marginTop: '0px' }}>
        {CHOICES.map((m) => (
          <button class={`seg ${minutes === m ? 'on' : ''}`} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
        ))}
      </div>
      <div style={{ marginTop: '12px' }}><Stepper label="Minutes" value={minutes} set={setMinutes} min={1} max={120} /></div>

      <div class="panel" style={{ marginTop: '16px' }} role="status">
        {fit.changed ? (
          <>
            <b>{fit.routine.name}</b>
            <p class="sub">About {Math.max(1, Math.round(fit.seconds / 60))} min, {fit.routine.blocks.length} of {routine.blocks.length} blocks.</p>
            {fit.scaled && <p class="sub">Holds and sets are shorter.</p>}
            {fit.dropped.length > 0 && <p class="sub">Left out: {fit.dropped.join(', ')}.</p>}
          </>
        ) : (
          <p class="sub">{routine.name} takes about {full} min, so it already fits. Nothing to cut.</p>
        )}
      </div>
      <button class="btn-primary" style={{ marginTop: '16px' }} onClick={start}>{fit.changed ? 'Start the quick version' : 'Start session'}</button>
    </Sheet>
  );
}
