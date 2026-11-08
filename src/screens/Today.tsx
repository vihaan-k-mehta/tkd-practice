import { Settings as Gear } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { TimeSheet } from '../app/TimeSheet';
import { MatArt } from '../app/MatArt';
import { addDays, availFor, availLabel, weekdayOf, doneFlags, missedDates, occurrences, streak } from '../engine/schedule';
import { fitRoutine } from '../engine/fit';
import { go } from '../app/router';
import { beltFor, isPaused } from '../engine/quests';
import { notice, progress, quickRoutine, getRoutine, history, lastRoutine, localDate, schedule, userRoutines } from '../data/library';
import { TEMPLATES } from '../data/templates';
import { routineMinutes } from '../engine/plan';

export function Header({ title }: { title: string }) {
  return (
    <header class="topbar">
      <div>
        <h1>{title}</h1>
        <span class="underline" />
      </div>
      <a class="icon-btn" href="#/settings" aria-label="Settings"><Gear size={26} strokeWidth={2.25} aria-hidden="true" /></a>
    </header>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Today() {
  const mine = userRoutines.use();
  const last = lastRoutine.use();
  const past = history.use();
  const [timeOpen, setTimeOpen] = useState(false);
  const sched = schedule.use();
  const today = localDate();
  const occ = occurrences(sched, today);
  const flags = doneFlags(occ, past, today);
  const nextIdx = flags.findIndex((f) => !f);
  const planned = nextIdx >= 0 ? getRoutine(occ[nextIdx].routineId, mine) : undefined;
  const allDone = occ.length > 0 && nextIdx < 0;
  const routine = planned ?? getRoutine(last.id, mine) ?? TEMPLATES[0];
  const free = availFor(sched, weekdayOf(today));
  const tight = !!free.minutes && routineMinutes(routine) > free.minutes;
  const quick = tight ? fitRoutine(routine, free.minutes!) : undefined;
  const startQuick = () => { if (!quick) return; quickRoutine.set(() => ({ routine: quick.routine })); go(`session/${quick.routine.id}`); };
  const prog = progress.use();
  const note = notice.use();
  const belt = beltFor(prog.bestXp);
  const pausedFn = (d: string) => isPaused(prog, d);
  const sc = streak(sched, past, today, pausedFn);
  const missed = missedDates(sched, past, today, pausedFn).filter((d) => d >= addDays(today, -7)).length;
  const weekAgo = Date.now() - 7 * 86400_000;
  const thisWeek = past.filter((h) => new Date(`${h.date}T00:00:00`).getTime() >= weekAgo).length;
  const latest = past[0];

  return (
    <main class="screen">
      <Header title="Today" />

      {note.lines.length > 0 && (
        <div class="banner" role="status">
          <b>While you were away</b>
          <ul>{note.lines.map((l) => <li>{l}</li>)}</ul>
          <button class="link-btn" onClick={() => notice.set(() => ({ lines: [] }))}>Dismiss</button>
        </div>
      )}
      <a class="belt-chip" href="#/quests" aria-label={`${belt.belt.name} belt, ${prog.xp} XP. Open quests`}>
        <span class="belt-strip" style={{ background: belt.belt.color }} />
        <span class="grow"><b>{belt.belt.name} belt</b><span class="sub block">{prog.xp} XP{belt.next ? `, ${belt.next.xp - prog.bestXp} to ${belt.next.name}` : ''}</span></span>
      </a>
      <article class="card">
        <p class="sub">{planned ? `Planned for ${occ[nextIdx].time}` : allDone ? 'Today is done. Extra practice' : occ.length === 0 && sched.weekly.some((l) => l.length) ? 'Rest day. Optional practice' : 'Next session'}</p>
        <h2>{routine.name}</h2>
        <p class="sub">{routineMinutes(routine)} minutes, {routine.blocks.length} blocks</p>
        <div class="media"><MatArt /></div>
        {(free.from || free.until || free.minutes) && <p class="sub" style={{ marginTop: '10px' }}>Today you are free: {availLabel(free)}.</p>}
        {quick && <button class="btn-primary" style={{ marginTop: '12px' }} onClick={startQuick}>Start the {Math.max(1, Math.round(quick.seconds / 60))} min version</button>}
        <a class={quick ? 'link-btn' : 'btn-primary'} href={`#/session/${routine.id}`} style={{ textDecoration: 'none', margin: quick ? '8px auto 0' : undefined }}>{quick ? `Do the full ${routineMinutes(routine)} min anyway` : 'Start session'}</a>
        <button class="link-btn" style={{ margin: '8px auto 0' }} onClick={() => setTimeOpen(true)}>Short on time?</button>
        <a class="link-btn" href="#/routines" style={{ margin: '8px auto 0' }}>Choose a different routine</a>
        {timeOpen && <TimeSheet routine={routine} initial={free.minutes} onClose={() => setTimeOpen(false)} />}
      </article>

      <p class="eyebrow">Recent</p>
      <ul class="rowlist">
        <li><span>Day streak</span><b>{sc}</b></li>
        <li><span>Sessions in the last 7 days</span><b>{thisWeek}</b></li>
        {missed > 0 && <li><span>Missed in the last 7 days</span><b>{missed}</b></li>}
        {latest
          ? <li><span class="grow">Last session<span class="sub block">{latest.routineName}, {latest.date}</span></span><b>{mmss(latest.totalSec)}</b></li>
          : <li><span class="sub">No sessions yet. Start one above.</span></li>}
      </ul>
    </main>
  );
}
