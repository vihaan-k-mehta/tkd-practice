import { Ellipsis, Flame, Search } from 'lucide-preact';
import { sample } from '../data/sample';
import { MatArt } from '../app/MatArt';

export function Header({ title }: { title: string }) {
  return (
    <header class="topbar">
      <div>
        <h1>{title}</h1>
        <span class="underline" />
      </div>
      <a class="icon-btn" href="#/settings" aria-label="Settings"><Search size={26} strokeWidth={2.25} aria-hidden="true" /></a>
    </header>
  );
}

export function Today() {
  const { next, streak, weekQuest, bw } = sample;
  return (
    <main class="screen">
      <Header title="Today" />

      <article class="card">
        <div class="card-head">
          <span class="avatar" aria-hidden="true">TK</span>
          <div class="grow"><strong>Next session</strong><div class="sub">{next.when}</div></div>
          <button class="icon-btn" aria-label="More options"><Ellipsis size={22} aria-hidden="true" /></button>
        </div>
        <hr />
        <h2>{next.name}</h2>
        <p class="sub">{next.minutes} minutes, {next.blocks} blocks</p>
        <div class="media">
          <MatArt />
          <div class="chips"><span class="chip">Level {bw.level}</span><span class="chip muted">{bw.weight}</span></div>
        </div>
        <div class="stats">
          <div><span class="sub">Time</span><b>{next.minutes}m</b></div>
          <div><span class="sub">Blocks</span><b>{next.blocks}</b></div>
          <div><span class="sub">Streak</span><b>{streak.days}d</b></div>
        </div>
        <a class="btn-primary" href="#/session" style={{ textDecoration: 'none', marginTop: 18 }}>Start session</a>
      </article>

      <p class="eyebrow">This week</p>
      <ul class="rowlist">
        <li>
          <div class="grow">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{weekQuest.label}</span><b>{weekQuest.done} of {weekQuest.of}</b>
            </div>
            <div class="progress"><span style={{ width: `${(weekQuest.done / weekQuest.of) * 100}%` }} /></div>
          </div>
        </li>
        <li><span>Bill Wallace</span><b>Level {bw.level}, {bw.weight}</b></li>
      </ul>
    </main>
  );
}
