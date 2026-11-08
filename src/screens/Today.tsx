import { Settings as Gear } from 'lucide-preact';
import { MatArt } from '../app/MatArt';
import { getRoutine, history, lastRoutine, userRoutines } from '../data/library';
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
  const routine = getRoutine(last.id, mine) ?? TEMPLATES[0];
  const weekAgo = Date.now() - 7 * 86400_000;
  const thisWeek = past.filter((h) => new Date(`${h.date}T00:00:00`).getTime() >= weekAgo).length;
  const latest = past[0];

  return (
    <main class="screen">
      <Header title="Today" />

      <article class="card">
        <p class="sub">Next session</p>
        <h2>{routine.name}</h2>
        <p class="sub">{routineMinutes(routine)} minutes, {routine.blocks.length} blocks</p>
        <div class="media"><MatArt /></div>
        <a class="btn-primary" href={`#/session/${routine.id}`} style={{ textDecoration: 'none' }}>Start session</a>
        <a class="link-btn" href="#/routines" style={{ margin: '8px auto 0' }}>Choose a different routine</a>
      </article>

      <p class="eyebrow">Recent</p>
      <ul class="rowlist">
        <li><span>Sessions in the last 7 days</span><b>{thisWeek}</b></li>
        {latest
          ? <li><span class="grow">Last session<span class="sub block">{latest.routineName}, {latest.date}</span></span><b>{mmss(latest.totalSec)}</b></li>
          : <li><span class="sub">No sessions yet. Start one above.</span></li>}
      </ul>
    </main>
  );
}
