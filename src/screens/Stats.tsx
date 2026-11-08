import { useState } from 'preact/hooks';
import { Header } from './Today';
import { BarChart, LineChart, SplitBar } from './Charts';
import { history, localDate, progress } from '../data/library';
import { EXERCISES } from '../data/exercises';
import { bestDayRun, cumulativeKicks, holdSeries, legSplit, summary, weeklyBuckets, weightSeries } from '../engine/stats';
import { beltFor } from '../engine/quests';

const short = (d: string) => { const [, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}`; };
const WEIGHTED = EXERCISES.filter((e) => e.equipment.includes('ankleWeights'));

export function Stats() {
  const h = history.use();
  const p = progress.use();
  const [ex, setEx] = useState('bill-wallace-routine');
  const today = localDate();
  const s = summary(h);
  const weeks = weeklyBuckets(h, today, 12);
  const wl = weightSeries(h, ex);
  const belt = beltFor(p.bestXp);
  const cur = p.weights[ex] ?? 0;
  const lbl = (w: { weekStart: string }) => short(w.weekStart);

  return (
    <main class="screen">
      <Header title="Stats" />
      {h.length === 0 && <p class="empty">No sessions yet. Finish one and your numbers and graphs appear here.</p>}

      <div class="tiles three-t">
        <div class="tile"><b>{s.sessions}</b><span>Sessions</span></div>
        <div class="tile"><b>{s.kicks}</b><span>Kicks thrown</span></div>
        <div class="tile"><b>{s.minutes}</b><span>Minutes</span></div>
      </div>
      <div class="tiles three-t" style={{ marginTop: '0px' }}>
        <div class="tile"><b>{bestDayRun(h)}</b><span>Best run, days</span></div>
        <div class="tile"><b>{cur}</b><span>lb now</span></div>
        <div class="tile"><b>{belt.belt.name}</b><span>Belt</span></div>
      </div>
      {s.drops > 0 && <p class="sub note">Foot touched down {s.drops} time{s.drops > 1 ? 's' : ''} in total, {s.penalties} not fixed in time.</p>}

      <p class="eyebrow">Training</p>
      <BarChart title="Sessions each week" unit="sessions" data={weeks.map((w) => ({ label: lbl(w), value: w.sessions }))} />
      <BarChart title="Kicks thrown each week" unit="kicks" data={weeks.map((w) => ({ label: lbl(w), value: w.kicks }))} />
      <LineChart title="Total kicks thrown" unit="kicks" data={cumulativeKicks(h).map((c) => ({ label: short(c.date), value: c.total }))} />
      <BarChart title="Sets completed each week" unit="sets" data={weeks.map((w) => ({ label: lbl(w), value: w.sets }))} />
      <SplitBar title="Left and right kicks" a={{ label: 'Left', value: legSplit(h).left }} b={{ label: 'Right', value: legSplit(h).right }} />

      <p class="eyebrow">Ankle weight</p>
      <label class="sub" for="wex">Exercise</label>
      <select id="wex" class="field" value={ex} onChange={(e) => setEx((e.target as HTMLSelectElement).value)}>
        <option value="bill-wallace-routine">Bill Wallace routine</option>
        {WEIGHTED.filter((e) => e.id !== 'bill-wallace-routine').map((e) => <option value={e.id}>{e.name}</option>)}
      </select>
      <p class="sub note">Now {cur} lb. Two clean sessions in a row adds half a pound. {p.cleanStreak[ex] ? `One clean session so far.` : ''}</p>
      <LineChart title="Ankle weight over time" unit="lb" step data={wl.map((w) => ({ label: short(w.date), value: w.lb }))} />

      <p class="eyebrow">Flexibility</p>
      <LineChart title="How high you hold your leg" unit="height" data={holdSeries(h).map((x) => ({ label: short(x.date), value: Number(x.height.toFixed(2)) }))} />
      <p class="sub note">Height is the ankle above your standing foot, measured in torso lengths. Higher is better.</p>

      <p class="eyebrow">Your sessions</p>
      <ul class="rowlist">
        {h.slice(0, 8).map((r) => <li><span class="grow">{r.routineName}<span class="sub block">{r.date}{r.unverified ? ', unverified' : ''}{r.drops ? `, ${r.drops} foot drop${r.drops > 1 ? 's' : ''}` : ''}</span></span><b>{Math.round(r.totalSec / 60)} min</b></li>)}
        {h.length === 0 && <li><span class="sub">Nothing yet.</span></li>}
      </ul>
    </main>
  );
}
