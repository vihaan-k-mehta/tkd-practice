import { useState } from 'preact/hooks';
import { CalendarPlus, ChevronLeft, ChevronRight, Flame, Plus, Trash2 } from 'lucide-preact';
import { Header } from './Today';
import { Sheet } from '../app/Sheet';
import { routineMinutes } from '../engine/plan';
import { Stepper } from '../app/Sheet';
import type { Avail } from '../engine/schedule';
import { getRoutine, history, localDate, schedule, uid, userRoutines } from '../data/library';
import { TEMPLATES } from '../data/templates';
import { weekdayOf, availFor, availLabel, timeInWindow, dayState, doneFlags, monthGrid, occurrences, streak, toIcs, type DayState } from '../engine/schedule';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATE_LABEL: Record<DayState, string> = { rest: 'rest', planned: 'planned', done: 'done', partial: 'partly done', missed: 'missed' };
const STATE_MARK: Record<DayState, string> = { rest: '', planned: '○', done: '✓', partial: '◐', missed: '✕' };

function RoutineSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const mine = userRoutines.use();
  return (
    <select class="field" aria-label={label} value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
      {mine.length > 0 && <optgroup label="My routines">{mine.map((r) => <option value={r.id}>{r.name}</option>)}</optgroup>}
      <optgroup label="Templates">{TEMPLATES.map((r) => <option value={r.id}>{r.name}</option>)}</optgroup>
    </select>
  );
}

function AddSlot({ title, avail = {}, onSave, onClose }: { title: string; avail?: Avail; onSave: (routineId: string, time: string) => void; onClose: () => void }) {
  const [routineId, setRoutineId] = useState(TEMPLATES[0].id);
  const [time, setTime] = useState(avail.from ?? '18:00');
  const mine = userRoutines.use();
  const r = getRoutine(routineId, mine);
  const mins = r ? routineMinutes(r) : 0;
  return (
    <Sheet title={title} onClose={onClose}>
      <label class="eyebrow" for="slot-routine">Routine</label>
      <RoutineSelect value={routineId} onChange={setRoutineId} label="Routine" />
      <label class="eyebrow" for="slot-time">Time</label>
      <input id="slot-time" class="field" type="time" value={time} onInput={(e) => setTime((e.target as HTMLInputElement).value || '18:00')} />
      <p class="sub note">You are free: {availLabel(avail)}.</p>
      {!timeInWindow(time, avail) && <p class="sub note warn" role="status">That time is outside the hours you said you are free.</p>}
      {avail.minutes && mins > avail.minutes && <p class="sub note warn" role="status">This takes about {mins} min and you have {avail.minutes}. It will be offered as a shortened version.</p>}
      <button class="btn-primary" style={{ marginTop: '20px' }} onClick={() => { onSave(routineId, time); onClose(); }}>Add session</button>
    </Sheet>
  );
}

function DaySheet({ date, today, onClose }: { date: string; today: string; onClose: () => void }) {
  const s = schedule.use();
  const past = history.use();
  const mine = userRoutines.use();
  const [adding, setAdding] = useState(false);
  const occ = occurrences(s, date);
  const flags = doneFlags(occ, past, date);
  const state = dayState(s, past, date, today);
  const nice = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const moveTo = (o: (typeof occ)[number], to: string) => {
    if (!to || to === date) return;
    if (o.extra) schedule.set((x) => ({ ...x, extras: x.extras.map((e) => (e.id === o.slotId ? { ...e, date: to } : e)) }));
    else schedule.set((x) => ({ ...x, moves: [...x.moves.filter((m) => !(m.slotId === o.slotId && m.from === date)), { slotId: o.slotId, from: date, to }] }));
  };
  const remove = (o: (typeof occ)[number]) => {
    if (o.extra) schedule.set((x) => ({ ...x, extras: x.extras.filter((e) => e.id !== o.slotId) }));
    else schedule.set((x) => ({ ...x, moves: [...x.moves.filter((m) => !(m.slotId === o.slotId && m.from === date)), { slotId: o.slotId, from: date, to: '' }] }));
  };
  return (
    <Sheet title={nice} onClose={onClose}>
      <p class="sub" style={{ marginBottom: '8px' }}>{date === today ? 'Today, ' : ''}{STATE_LABEL[state]}. Free: {availLabel(availFor(s, weekdayOf(date)))}.</p>
      {occ.length === 0 && <p class="empty">Nothing planned. This is a rest day.</p>}
      <ul class="rowlist">
        {occ.map((o, i) => (
          <li>
            <span class="grow"><b>{getRoutine(o.routineId, mine)?.name ?? 'Deleted routine'}</b>
              <span class="sub block">{o.time}{o.extra ? ', one-off' : ''}{flags[i] ? ', done' : ''}</span>
            </span>
            {!flags[i] && date <= today && getRoutine(o.routineId, mine) && <a class="link-btn" href={`#/session/${o.routineId}`}>Start</a>}
          </li>
        ))}
      </ul>
      {occ.some((_, i) => !flags[i]) && date >= today && (
        <>
          <label class="eyebrow" for="move-to">Move the first unfinished session to</label>
          <input id="move-to" class="field" type="date" min={today} value={date}
            onChange={(e) => { const i = flags.findIndex((f) => !f); if (i >= 0) { moveTo(occ[i], (e.target as HTMLInputElement).value); onClose(); } }} />
        </>
      )}
      {occ.some((_, i) => !flags[i]) && date >= today && (
        <button class="discard" style={{ color: 'var(--ink)', marginTop: '12px' }} onClick={() => { const i = flags.findIndex((f) => !f); if (i >= 0) remove(occ[i]); onClose(); }}>Remove the first unfinished session</button>
      )}
      <button class="btn-primary" style={{ marginTop: '16px' }} onClick={() => setAdding(true)}><Plus size={22} aria-hidden="true" /> Add a one-off session</button>
      {adding && <AddSlot title="One-off session" avail={availFor(s, weekdayOf(date))} onClose={() => setAdding(false)}
        onSave={(routineId, time) => schedule.set((x) => ({ ...x, extras: [...x.extras, { id: uid(), date, routineId, time }] }))} />}
    </Sheet>
  );
}

function AvailSheet({ wd, onClose }: { wd: number; onClose: () => void }) {
  const s = schedule.use();
  const cur = availFor(s, wd);
  const [from, setFrom] = useState(cur.from ?? '');
  const [until, setUntil] = useState(cur.until ?? '');
  const [minutes, setMinutes] = useState(cur.minutes ?? 0);
  const save = (a: Avail) => { schedule.set((x) => ({ ...x, avail: Array.from({ length: 7 }, (_, i) => (i === wd ? a : availFor(x, i))) })); onClose(); };
  const draft: Avail = { ...(from ? { from } : {}), ...(until ? { until } : {}), ...(minutes ? { minutes } : {}) };
  return (
    <Sheet title={`${WEEKDAYS[wd]}: when are you free?`} onClose={onClose}>
      <div class="seg-row" style={{ marginTop: '0px' }}>
        <button class="seg" onClick={() => { setFrom('17:00'); setUntil(''); }}>After 5 pm</button>
        <button class="seg" onClick={() => { setFrom(''); setUntil('08:00'); }}>Before 8 am</button>
        <button class="seg" onClick={() => { setFrom(''); setUntil(''); setMinutes(0); }}>All day</button>
      </div>
      <label class="eyebrow" for="av-from">Free from (optional)</label>
      <input id="av-from" class="field" type="time" value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} />
      <label class="eyebrow" for="av-until">Free until (optional)</label>
      <input id="av-until" class="field" type="time" value={until} onInput={(e) => setUntil((e.target as HTMLInputElement).value)} />
      <p class="eyebrow">How many minutes can you train? 0 means no limit</p>
      <Stepper label="Minutes" value={minutes} set={setMinutes} min={0} max={240} step={5} />
      <p class="sub note" role="status">{availLabel(draft)}</p>
      <button class="btn-primary" style={{ marginTop: '16px' }} onClick={() => save(draft)}>Save</button>
    </Sheet>
  );
}

function WeeklyPlan() {
  const s = schedule.use();
  const mine = userRoutines.use();
  const [adding, setAdding] = useState<number | null>(null);
  const [availOpen, setAvailOpen] = useState<number | null>(null);
  const removeSlot = (wd: number, id: string) => schedule.set((x) => ({ ...x, weekly: x.weekly.map((l, i) => (i === wd ? l.filter((z) => z.id !== id) : l)) }));
  return (
    <>
      <p class="sub">A day with no sessions is a rest day. Rest days never break your streak.</p>
      {WEEKDAYS.map((name, wd) => (
        <section>
          <p class="eyebrow">{name}</p>
          <button class="row-btn" onClick={() => setAvailOpen(wd)} aria-label={`${name} availability: ${availLabel(availFor(s, wd))}`}>
            <span class="grow"><span class="sub">When you are free</span> <b>{availLabel(availFor(s, wd))}</b></span><ChevronRight size={20} aria-hidden="true" />
          </button>
          <ul class="rowlist">
            {s.weekly[wd].length === 0 && <li><span class="sub">Rest day</span></li>}
            {s.weekly[wd].map((z) => (
              <li>
                <span class="grow"><b>{getRoutine(z.routineId, mine)?.name ?? 'Deleted routine'}</b><span class="sub block">{z.time}</span></span>
                <button class="icon-btn" aria-label={`Remove ${name} ${z.time} session`} onClick={() => removeSlot(wd, z.id)}><Trash2 size={22} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <button class="link-btn" onClick={() => setAdding(wd)} aria-label={`Add a session on ${name}`}><Plus size={18} aria-hidden="true" /> Add session</button>
        </section>
      ))}
      {availOpen !== null && <AvailSheet wd={availOpen} onClose={() => setAvailOpen(null)} />}
      {adding !== null && <AddSlot title={`${WEEKDAYS[adding]} session`} avail={availFor(s, adding)} onClose={() => setAdding(null)}
        onSave={(routineId, time) => schedule.set((x) => ({ ...x, weekly: x.weekly.map((l, i) => (i === adding ? [...l, { id: uid(), routineId, time }] : l)) }))} />}
    </>
  );
}

function Calendar() {
  const s = schedule.use();
  const past = history.use();
  const today = localDate();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [open, setOpen] = useState<string | null>(null);
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  return (
    <>
      <div class="cal-head">
        <button class="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={24} aria-hidden="true" /></button>
        <h3 aria-live="polite">{MONTHS[ym.m]} {ym.y}</h3>
        <button class="icon-btn" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={24} aria-hidden="true" /></button>
      </div>
      <div class="cal" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => <span class="cal-dow" aria-hidden="true">{d}</span>)}
        {monthGrid(ym.y, ym.m).map((d) => {
          const st = dayState(s, past, d, today);
          const inMonth = Number(d.slice(5, 7)) - 1 === ym.m;
          return (
            <button role="gridcell" class={`cal-day st-${st} ${d === today ? 'is-today' : ''} ${inMonth ? '' : 'out'}`} data-date={d}
              aria-label={`${d}, ${d === today ? 'today, ' : ''}${STATE_LABEL[st]}`} onClick={() => setOpen(d)}>
              <span>{Number(d.slice(8))}</span><i aria-hidden="true">{STATE_MARK[st]}</i>
            </button>
          );
        })}
      </div>
      <p class="sub note">{'○'} planned, {'✓'} done, {'◐'} partly done, {'✕'} missed. No mark means rest.</p>
      {open && <DaySheet date={open} today={today} onClose={() => setOpen(null)} />}
    </>
  );
}

export function SchedulePage() {
  const s = schedule.use();
  const past = history.use();
  const mine = userRoutines.use();
  const [tab, setTab] = useState<'calendar' | 'plan'>('calendar');
  const today = localDate();
  const sc = streak(s, past, today);
  const exportIcs = () => {
    const text = toIcs(s, (id) => getRoutine(id, mine)?.name ?? 'Training', today);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'tkd-practice.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const hasPlan = s.weekly.some((l) => l.length > 0);
  return (
    <main class="screen">
      <Header title="Schedule" />
      <div class="tiles">
        <div class="tile"><b><Flame size={26} aria-hidden="true" /> {sc}</b><span>Day streak</span></div>
        <div class="tile"><b>{s.weekly.reduce((a, l) => a + l.length, 0)}</b><span>Sessions a week</span></div>
      </div>
      <div class="seg-row" role="tablist">
        <button role="tab" aria-selected={tab === 'calendar'} class={`seg ${tab === 'calendar' ? 'on' : ''}`} onClick={() => setTab('calendar')}>Calendar</button>
        <button role="tab" aria-selected={tab === 'plan'} class={`seg ${tab === 'plan' ? 'on' : ''}`} onClick={() => setTab('plan')}>Weekly plan</button>
      </div>
      {!hasPlan && tab === 'calendar' && (
        <p class="empty">Nothing scheduled yet. <button class="link-btn" onClick={() => setTab('plan')}>Build your weekly plan</button></p>
      )}
      <div style={{ marginTop: '16px' }}>{tab === 'calendar' ? <Calendar /> : <WeeklyPlan />}</div>

      <p class="eyebrow">Streak rules</p>
      <ul class="rowlist">
        <li>
          <div class="grow"><div>Weekly rest pass</div><div class="sub">Forgives one missed session a week.</div></div>
          <button class={`switch ${s.restPass ? 'on' : ''}`} role="switch" aria-checked={s.restPass} aria-label="Weekly rest pass" onClick={() => schedule.set((x) => ({ ...x, restPass: !x.restPass }))}><span /></button>
        </li>
      </ul>

      <p class="eyebrow">Reminders</p>
      <button class="btn-primary" disabled={!hasPlan} onClick={exportIcs}><CalendarPlus size={22} aria-hidden="true" /> Add to calendar</button>
      <p class="sub note">A website cannot ring while it is closed. This downloads a calendar file with your weekly sessions and a reminder 10 minutes before each one. Open it and your phone's calendar does the reminding.</p>
    </main>
  );
}
