import { useState } from 'preact/hooks';
import { ArrowDown, ArrowUp, ChevronLeft, Plus } from 'lucide-preact';
import { Sheet, Stepper } from '../app/Sheet';
import { CATEGORIES, EXERCISES, exerciseById } from '../data/exercises';
import { blockFor } from '../data/templates';
import { deleteRoutine, equipment, getRoutine, progress, saveRoutine, uid, userRoutines } from '../data/library';
import { routineMinutes, targetSummary, warmupReminderIndexes } from '../engine/plan';
import { go } from '../app/router';
import type { Block, Routine, Sides } from '../data/types';

function initial(id: string | undefined): { draft: Routine; fromTemplate: boolean } {
  if (!id || id === 'new') return { draft: { id: uid(), name: 'New routine', blocks: [] }, fromTemplate: true };
  const r = getRoutine(id);
  if (!r) return { draft: { id: uid(), name: 'New routine', blocks: [] }, fromTemplate: true };
  return { draft: JSON.parse(JSON.stringify(r)), fromTemplate: !!r.template };
}

export function RoutineBuilder({ id }: { id?: string }) {
  const mine = userRoutines.use();
  const own = equipment.use();
  const [state] = useState(() => initial(id));
  const [draft, setDraft] = useState<Routine>(state.draft);
  const [dirty, setDirty] = useState(id === 'new');
  const [saved, setSaved] = useState(false);
  const [edit, setEdit] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [cat, setCat] = useState<string>('All');

  const isTemplate = !!getRoutine(draft.id)?.template;
  const exists = mine.some((r) => r.id === draft.id);
  const change = (fn: (r: Routine) => Routine) => { setDraft(fn); setDirty(true); setSaved(false); };
  const setBlock = (i: number, fn: (b: Block) => Block) => change((r) => ({ ...r, blocks: r.blocks.map((b, j) => (j === i ? fn(b) : b)) }));
  const move = (i: number, d: -1 | 1) => change((r) => {
    const j = i + d; if (j < 0 || j >= r.blocks.length) return r;
    const blocks = [...r.blocks]; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; return { ...r, blocks };
  });
  const save = () => {
    const id = getRoutine(draft.id)?.template ? uid() : draft.id; // a changed template becomes your own copy
    const toSave: Routine = { ...draft, id, template: undefined, name: draft.name.trim() || 'My routine' };
    saveRoutine(toSave); setDraft(toSave); setDirty(false); setSaved(true);
    return toSave;
  };
  const start = () => {
    if (isTemplate && !dirty) { go(`session/${draft.id}`); return; }
    go(`session/${(dirty ? save() : draft).id}`);
  };
  const reminders = warmupReminderIndexes(draft);

  const pickList = EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (cat === 'All' || e.category === cat) && (!onlyMine || e.equipment.every((x) => own[x])));
  const editing = edit !== null ? draft.blocks[edit] : null;
  const prog = progress.use();
  const exEd = editing ? exerciseById(editing.exerciseId) : null;

  return (
    <main class="screen">
      <header class="topbar session-top">
        <a class="icon-btn" href="#/routines" aria-label="Back to routines"><ChevronLeft size={28} aria-hidden="true" /></a>
        <h3>{isTemplate && !dirty ? 'Template' : 'Routine'}</h3>
        <span style={{ width: '48px' }} />
      </header>

      <label class="eyebrow" for="rname">Name</label>
      <input id="rname" class="field" maxLength={60} value={draft.name} onInput={(e) => change((r) => ({ ...r, name: (e.target as HTMLInputElement).value }))} />
      <p class="sub note">About {routineMinutes(draft)} minutes, {draft.blocks.length} blocks.{isTemplate && !dirty ? ' Changing a template saves your own copy.' : ''}</p>

      {draft.blocks.length === 0 ? <p class="empty">Nothing in this routine yet. Add an exercise.</p> : (
        <ul class="rowlist blocks">
          {draft.blocks.map((b, i) => {
            const ex = exerciseById(b.exerciseId)!;
            return (
              <li>
                <button class="row-btn" onClick={() => setEdit(i)} aria-label={`Edit ${ex.name}`}>
                  <span class="grow">
                    <b>{ex.name}</b>
                    <span class="sub block">{targetSummary(b, ex)}</span>
                    {reminders.has(i) && <span class="sub block warn">Warm up first</span>}
                  </span>
                </button>
                <button class="icon-btn" aria-label={`Move ${ex.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={20} aria-hidden="true" /></button>
                <button class="icon-btn" aria-label={`Move ${ex.name} down`} disabled={i === draft.blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown size={20} aria-hidden="true" /></button>
              </li>
            );
          })}
        </ul>
      )}

      <button class="btn-ghost" onClick={() => setPicker(true)}><Plus size={22} aria-hidden="true" /> Add exercise</button>
      <button class="btn-primary" style={{ marginTop: '28px' }} disabled={draft.blocks.length === 0} onClick={start}>Start session</button>
      <button class="btn-ghost" disabled={draft.blocks.length === 0 || (!dirty && !isTemplate)} onClick={save}>Save routine</button>
      {saved && <p class="sub hint" role="status">Routine saved</p>}
      {exists && !dirty && <button class="discard" onClick={() => { if (confirm('Delete this routine?')) { deleteRoutine(draft.id); go('routines'); } }}>Delete routine</button>}

      {picker && (
        <Sheet title="Add exercise" onClose={() => setPicker(false)}>
          <input class="field" placeholder="Search exercises" aria-label="Search exercises" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <div class="chips-row">
            {['All', ...CATEGORIES].map((c) => <button class={`seg ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          <button class={`seg ${onlyMine ? 'on' : ''}`} style={{ width: '100%', margin: '8px 0' }} aria-pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>Only what I own</button>
          {pickList.map((e) => (
            <button class="opt" onClick={() => { change((r) => ({ ...r, blocks: [...r.blocks, blockFor(e.id)] })); setPicker(false); }}>{e.name}</button>
          ))}
          {pickList.length === 0 && <p class="empty">No exercises match.</p>}
        </Sheet>
      )}

      {editing && exEd && edit !== null && (
        <Sheet title={exEd.name} onClose={() => setEdit(null)}>
          {(exEd.blockType === 'hold' || exEd.blockType === 'rest') && (
            <Stepper label="Seconds" value={editing.target.seconds ?? 30} step={5} min={5} max={600} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, seconds: n } }))} />
          )}
          {exEd.blockType === 'reps' && (
            <>
              <Stepper label="Reps" value={editing.target.reps ?? 10} max={200} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, reps: n } }))} />
              <Stepper label="Sets" value={editing.target.rounds ?? 1} max={20} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, rounds: n } }))} />
              {(editing.target.rounds ?? 1) > 1 && <Stepper label="Rest between sets" unit="s" value={editing.target.restSec ?? 60} step={15} min={0} max={300} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, restSec: n } }))} />}
            </>
          )}
          {exEd.blockType === 'rounds' && (
            <>
              <Stepper label="Rounds" value={editing.target.rounds ?? 3} max={30} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, rounds: n } }))} />
              <Stepper label="Work" unit="s" value={editing.target.workSec ?? 60} step={10} min={10} max={600} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, workSec: n } }))} />
              <Stepper label="Rest" unit="s" value={editing.target.restSec ?? 30} step={10} min={0} max={300} set={(n) => setBlock(edit, (b) => ({ ...b, target: { ...b.target, restSec: n } }))} />
            </>
          )}
          {exEd.equipment.includes('ankleWeights') && (
            <Stepper label="Ankle weight" unit="lb" value={prog.weights[exEd.id] ?? 0} step={0.5} min={0} max={20} set={(n) => progress.set((x) => ({ ...x, weights: { ...x.weights, [exEd.id]: n } }))} />
          )}
          {exEd.blockType === 'sequence' && <p class="sub note">The whole routine is done on one leg without putting the foot down except where it says, then the other leg.</p>}
          {(exEd.blockType === 'hold' || exEd.blockType === 'reps' || exEd.blockType === 'sequence') && (
            <div class="seg-row" style={{ marginTop: '14px' }}>
              {([['none', 'One side'], ['both', 'Both sides'], ['left', 'Left'], ['right', 'Right']] as [string, string][]).filter(([v]) => exEd.blockType !== 'sequence' || v !== 'none').map(([v, l]) => (
                <button class={`seg ${(editing.sides ?? 'none') === v ? 'on' : ''}`} onClick={() => setBlock(edit, (b) => ({ ...b, sides: v === 'none' ? undefined : (v as Sides) }))}>{v === 'none' ? 'No sides' : l}</button>
              ))}
            </div>
          )}
          <div class="two" style={{ marginTop: '18px' }}>
            <button class="select" onClick={() => { change((r) => ({ ...r, blocks: [...r.blocks.slice(0, edit + 1), JSON.parse(JSON.stringify(editing)), ...r.blocks.slice(edit + 1)] })); setEdit(null); }}>Duplicate</button>
            <button class="select warn-btn" onClick={() => { change((r) => ({ ...r, blocks: r.blocks.filter((_, j) => j !== edit) })); setEdit(null); }}>Remove</button>
          </div>
          <button class="btn-primary" style={{ marginTop: '14px' }} onClick={() => setEdit(null)}>Done</button>
        </Sheet>
      )}
    </main>
  );
}
