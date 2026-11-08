import { Settings } from 'lucide-preact';
import { sample } from '../data/sample';

export function Today() {
  const { next, streak, weekQuest, bw } = sample;
  return (
    <main class="screen">
      <header class="topbar">
        <h1>Today</h1>
        <a class="icon-btn" href="#/settings" aria-label="Settings">
          <Settings size={24} strokeWidth={1.75} aria-hidden="true" />
        </a>
      </header>
      <div class="belt-strip" role="img" aria-label={`${Math.round(streak.toNextBelt * 100)} percent to the next belt`}>
        <span style={{ width: `${streak.toNextBelt * 100}%` }} />
      </div>

      <section class="next" aria-labelledby="next-name">
        <p class="label">Next session, {next.when}</p>
        <h2 id="next-name">{next.name}</h2>
        <p class="meta">{next.minutes} minutes, {next.blocks} blocks</p>
        <button class="btn-primary" type="button">Start session</button>
      </section>

      <ul class="rows">
        <li class="row">
          <span>Streak</span>
          <span class="value">{streak.days} days</span>
        </li>
        <li class="row">
          <div class="stack">
            <div class="line">
              <span>{weekQuest.label}</span>
              <span class="value">{weekQuest.done} of {weekQuest.of}</span>
            </div>
            <div class="progress"><span style={{ width: `${(weekQuest.done / weekQuest.of) * 100}%` }} /></div>
          </div>
        </li>
        <li class="row">
          <span>Bill Wallace</span>
          <span class="value">Level {bw.level}, {bw.weight}</span>
        </li>
      </ul>
    </main>
  );
}
