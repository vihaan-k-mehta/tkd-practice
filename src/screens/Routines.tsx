import { useState } from 'preact/hooks';
import { ChevronRight, Plus, Users } from 'lucide-preact';
import { Header } from './Today';
import { Sheet } from '../app/Sheet';
import { TEMPLATES } from '../data/templates';
import { CATEGORIES, EXERCISES } from '../data/exercises';
import { equipment, userRoutines } from '../data/library';
import { equipmentNeeded, routineMinutes } from '../engine/plan';
import { EQUIPMENT_LABEL, type Exercise, type Routine } from '../data/types';
import { go } from '../app/router';
import { ExerciseAnim } from '../anim/ExerciseAnim';

export function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <p class="sub" style={{ marginBottom: '12px' }}>{ex.category}{ex.equipment.length ? `, needs ${ex.equipment.map((e) => EQUIPMENT_LABEL[e].toLowerCase()).join(' and ')}` : ''}</p>
      <ExerciseAnim id={ex.id} />
      <ul class="cues">{ex.cues.map((c) => <li>{c}</li>)}</ul>
      <p class="sub note">
        {ex.verify === 'none' ? 'The camera does not check this exercise.' :
          ex.verify === 'presence' ? 'The camera checks you are in view.' :
          ex.verify === 'motion' ? (ex.blockType === 'reps' ? 'The camera checks you are moving while you count. Reps only count while it sees you.' : 'The camera checks you are moving.') : 'The camera counts your kicks.'}
        {ex.needsPartner ? ' Needs a partner.' : ''}
      </p>
      <p class="sub note">A simplified drawing, not a replacement for your instructor. Record your own clip to add it here.</p>
    </Sheet>
  );
}

function RoutineRow({ r }: { r: Routine }) {
  const own = equipment.use();
  const missing = equipmentNeeded(r).filter((e) => !own[e]);
  return (
    <li>
      <button class="row-btn" onClick={() => go(`routine/${r.id}`)}>
        <span class="grow">
          <b>{r.name}</b>
          <span class="sub block">{routineMinutes(r)} min, {r.blocks.length} blocks{missing.length ? `, needs ${missing.map((m) => EQUIPMENT_LABEL[m].toLowerCase()).join(', ')}` : ''}</span>
        </span>
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </li>
  );
}

function Library() {
  const own = equipment.use();
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [solo, setSolo] = useState(false);
  const [open, setOpen] = useState<Exercise | null>(null);
  const list = EXERCISES.filter((e) =>
    e.name.toLowerCase().includes(q.toLowerCase()) &&
    (!onlyMine || e.equipment.every((x) => own[x])) && (!solo || !e.needsPartner));
  return (
    <>
      <input class="field" placeholder="Search exercises" aria-label="Search exercises" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="seg-row" style={{ marginTop: '12px' }}>
        <button class={`seg ${onlyMine ? 'on' : ''}`} aria-pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>Only what I own</button>
        <button class={`seg ${solo ? 'on' : ''}`} aria-pressed={solo} onClick={() => setSolo(!solo)}>Solo only</button>
      </div>
      {CATEGORIES.map((c) => {
        const items = list.filter((e) => e.category === c);
        if (!items.length) return null;
        return (
          <section>
            <p class="eyebrow">{c}</p>
            <ul class="rowlist">
              {items.map((e) => (
                <li><button class="row-btn" onClick={() => setOpen(e)}>
                  <span class="grow"><b>{e.name}</b>{e.needsPartner && <span class="sub block"><Users size={14} aria-hidden="true" /> Needs a partner</span>}</span>
                  <ChevronRight size={22} aria-hidden="true" />
                </button></li>
              ))}
            </ul>
          </section>
        );
      })}
      {list.length === 0 && <p class="empty">No exercises match. Try turning off a filter.</p>}
      {open && <ExerciseDetail ex={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function Routines() {
  const mine = userRoutines.use();
  const [tab, setTab] = useState<'routines' | 'exercises'>('routines');
  return (
    <main class="screen">
      <Header title="Routines" />
      <div class="seg-row" style={{ marginTop: '0px', marginBottom: '12px' }} role="tablist">
        <button role="tab" aria-selected={tab === 'routines'} class={`seg ${tab === 'routines' ? 'on' : ''}`} onClick={() => setTab('routines')}>Routines</button>
        <button role="tab" aria-selected={tab === 'exercises'} class={`seg ${tab === 'exercises' ? 'on' : ''}`} onClick={() => setTab('exercises')}>Exercises</button>
      </div>
      {tab === 'routines' ? (
        <>
          <button class="btn-primary" onClick={() => go('routine/new')}><Plus size={22} aria-hidden="true" /> New routine</button>
          {mine.length > 0 && (<><p class="eyebrow">My routines</p><ul class="rowlist">{mine.map((r) => <RoutineRow r={r} />)}</ul></>)}
          <p class="eyebrow">Templates</p>
          <ul class="rowlist">{TEMPLATES.map((r) => <RoutineRow r={r} />)}</ul>
        </>
      ) : <Library />}
    </main>
  );
}
