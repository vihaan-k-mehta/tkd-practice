import type { SessionRecord } from '../data/library';
import { addDays, dayState, doneFlags, occurrences, weekdayOf, type Schedule } from './schedule';

/** Pure quest, XP and consequence rules. Nothing here touches storage or the clock. */
export type Mode = 'off' | 'light' | 'strict';
export interface Goal { id: string; title: string; done: boolean }
export interface LogEntry { date: string; text: string }

export interface Progress {
  xp: number;              // current XP, never below 0
  bestXp: number;          // highest XP ever, so a penalty never demotes a belt
  mode: Mode;
  chosen: boolean;         // has the person picked a strictness yet
  pending?: { mode: Mode; from: string }; // a change waiting for next Monday
  processedThrough: string; // last day already judged ('' means none)
  passUsed: string[];      // Mondays of weeks whose rest pass is spent
  injuryUntil?: string;    // last day of injury mode
  bwDrops: number;         // times the Bill Wallace progression should restart one level lower
  makeUp: number;          // make-up rounds waiting for the next session
  forfeited: string[];     // days whose daily quest is forfeited
  awarded: string[];       // reward keys already paid, so nothing is paid twice
  weekFailed: string[];    // Mondays of weeks whose weekly quest failed
  bwLocked: string[];      // Mondays of weeks the Bill Wallace weight cannot advance
  goals: Goal[];
  log: LogEntry[];
}

export interface Ctx { schedule: Schedule; history: SessionRecord[]; today: string }

export type Event =
  | { type: 'xp'; delta: number; reason: string; date: string; key?: string }
  | { type: 'forfeit'; date: string; reason: string }
  | { type: 'makeup'; date: string }
  | { type: 'makeupDone'; date: string }
  | { type: 'passUsed'; week: string; date: string }
  | { type: 'weekFail'; week: string; date: string }
  | { type: 'bwLock'; week: string; date: string }
  | { type: 'injury'; until: string; date: string }
  | { type: 'mode'; mode: Mode; from: string; date: string };

export const XP = { perBlock: 4, blockCap: 40, fullBonus: 10, daily: 20, weekly: 50, extra: 15, extraPerDay: 3, goal: 25, strictLoss: 50, makeUpCap: 3 };

export const freshProgress = (today: string): Progress => ({
  xp: 0, bestXp: 0, mode: 'light', chosen: false, processedThrough: '', passUsed: [], bwDrops: 0, makeUp: 0,
  forfeited: [], awarded: [], weekFailed: [], bwLocked: [], goals: [], log: [],
});

const weekStart = (d: string) => addDays(d, -weekdayOf(d));
export const nextMonday = (d: string) => addDays(d, 7 - weekdayOf(d));

export const effectiveMode = (s: Progress, day: string): Mode => (s.pending && day >= s.pending.from ? s.pending.mode : s.mode);
const paused = (s: Progress, day: string) => !!s.injuryUntil && day <= s.injuryUntil;

/** Pick a strictness. The first choice applies now; later changes wait until next Monday so they cannot dodge a penalty. */
export function setStrictness(s: Progress, mode: Mode, today: string): Progress {
  if (!s.chosen) return { ...s, mode, chosen: true, pending: undefined };
  if (mode === s.mode && !s.pending) return s;
  if (mode === s.mode) return { ...s, pending: undefined };
  return { ...s, pending: { mode, from: nextMonday(today) } };
}

/** Injury mode pauses consequences and the streak for `days` days, and asks Bill Wallace to restart one level lower. */
export const startInjury = (_s: Progress, days: number, today: string): Event[] =>
  [{ type: 'injury', until: addDays(today, Math.max(1, Math.min(60, Math.round(days))) - 1), date: today }];

export const isPaused = paused;

/** Events for one finished day (plus the week's result when it is a Sunday). Pure; the caller applies them. */
export function evaluate(day: string, s: Progress, c: Ctx): Event[] {
  if (day >= c.today || paused(s, day)) return [];
  const events: Event[] = [];
  const mode = effectiveMode(s, day);
  const week = weekStart(day);
  const st = dayState(c.schedule, c.history, day, c.today);

  if ((st === 'missed' || st === 'partial') && mode !== 'off') {
    if (c.schedule.restPass && !s.passUsed.includes(week)) {
      events.push({ type: 'passUsed', week, date: day });
    } else {
      events.push({ type: 'forfeit', date: day, reason: 'Missed session' });
      if (mode === 'strict') {
        events.push({ type: 'xp', delta: -XP.strictLoss, reason: 'Missed session', date: day });
        events.push({ type: 'makeup', date: day });
      }
    }
  }

  if (weekdayOf(day) === 6) events.push(...weekEvents(week, mode, s, c));
  return events;
}

function weekEvents(week: string, mode: Mode, s: Progress, c: Ctx): Event[] {
  const out: Event[] = [];
  const end = addDays(week, 6);
  let scheduled = 0, done = 0, misses = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i);
    if (paused(s, d)) continue;
    const occ = occurrences(c.schedule, d);
    scheduled += occ.length;
    done += doneFlags(occ, c.history, d).filter(Boolean).length;
    const st = dayState(c.schedule, c.history, d, c.today);
    if (st === 'missed' || st === 'partial') misses++;
  }
  const unforgiven = Math.max(0, misses - (c.schedule.restPass && misses > 0 ? 1 : 0));
  const failed = mode !== 'off' && unforgiven >= 2;
  if (failed) {
    out.push({ type: 'weekFail', week, date: end });
    if (mode === 'strict') out.push({ type: 'bwLock', week, date: end });
  }
  const target = Math.min(4, scheduled);
  if (target > 0 && done >= target && !failed) out.push({ type: 'xp', delta: XP.weekly, reason: 'Weekly quest', date: end, key: `week:${week}` });
  return out;
}

/** XP for a finished session, plus clearing a make-up round. `c.history` must already include the session. */
export function awardSession(s: Progress, r: SessionRecord, c: Ctx): Event[] {
  const out: Event[] = [];
  const completed = r.blocks.filter((b) => b.completed).length;
  const total = r.blocks.length;
  const base = Math.min(XP.blockCap, completed * XP.perBlock) + (total > 0 && completed === total ? XP.fullBonus : 0);
  if (base > 0) out.push({ type: 'xp', delta: base, reason: 'Session', date: r.date, key: `session:${r.id}` });

  const occ = occurrences(c.schedule, r.date);
  const flags = doneFlags(occ, c.history, r.date);
  const allDone = occ.length > 0 && flags.every(Boolean);
  const finished = total > 0 && r.blocks.every((b) => b.completed || b.hurt);
  if (allDone && finished && !s.forfeited.includes(r.date)) out.push({ type: 'xp', delta: XP.daily, reason: 'Daily quest', date: r.date, key: `daily:${r.date}` });

  const sameToday = c.history.filter((h) => h.date === r.date && h.routineId === r.routineId).length;
  const planned = occ.filter((o) => o.routineId === r.routineId).length;
  const isExtra = sameToday > planned;
  const dailyDone = occ.length === 0 || flags.every(Boolean);
  const extrasPaid = s.awarded.filter((k) => k.startsWith(`extra:${r.date}:`)).length;
  if (isExtra && dailyDone && completed > 0 && extrasPaid < XP.extraPerDay) {
    out.push({ type: 'xp', delta: XP.extra, reason: 'Extra practice', date: r.date, key: `extra:${r.date}:${r.id}` });
  }
  if (s.makeUp > 0 && total > 0 && completed === total) out.push({ type: 'makeupDone', date: r.date });
  // Without the camera on a checked block, rewards are halved (honor mode).
  return r.unverified ? out.map((e) => (e.type === 'xp' && e.delta > 0 ? { ...e, delta: Math.floor(e.delta / 2) } : e)) : out;
}

/** Strict mode forfeits the day's quest when a session is quit early. Light only leaves the unfinished blocks uncounted. */
export function quitEvents(s: Progress, day: string, _c: Ctx): Event[] {
  if (paused(s, day) || effectiveMode(s, day) !== 'strict') return [];
  return [{ type: 'forfeit', date: day, reason: 'Quit early' }];
}

const describe = (e: Event): string | null => {
  switch (e.type) {
    case 'xp': return `${e.delta > 0 ? '+' : ''}${e.delta} XP, ${e.reason}`;
    case 'forfeit': return `Daily quest forfeited, ${e.reason.toLowerCase()}`;
    case 'makeup': return 'Make-up round added to your next session';
    case 'passUsed': return 'Rest pass used for a missed session';
    case 'weekFail': return 'Weekly quest failed, two misses this week';
    case 'bwLock': return 'Bill Wallace weight cannot advance this week';
    case 'injury': return `Injury mode on until ${e.until}`;
    default: return null;
  }
};

export function applyEvents(s: Progress, events: Event[]): Progress {
  const n: Progress = { ...s, passUsed: [...s.passUsed], forfeited: [...s.forfeited], awarded: [...s.awarded], weekFailed: [...s.weekFailed], bwLocked: [...s.bwLocked], log: [...s.log] };
  for (const e of events) {
    if (e.type === 'xp') {
      if (e.key && n.awarded.includes(e.key)) continue;
      if (e.key) n.awarded.push(e.key);
      n.xp = Math.max(0, n.xp + e.delta);
      n.bestXp = Math.max(n.bestXp, n.xp);
    } else if (e.type === 'forfeit') { if (!n.forfeited.includes(e.date)) n.forfeited.push(e.date); }
    else if (e.type === 'makeup') n.makeUp = Math.min(XP.makeUpCap, n.makeUp + 1);
    else if (e.type === 'makeupDone') n.makeUp = 0;
    else if (e.type === 'passUsed') { if (!n.passUsed.includes(e.week)) n.passUsed.push(e.week); }
    else if (e.type === 'weekFail') { if (!n.weekFailed.includes(e.week)) n.weekFailed.push(e.week); }
    else if (e.type === 'bwLock') { if (!n.bwLocked.includes(e.week)) n.bwLocked.push(e.week); }
    else if (e.type === 'injury') { n.injuryUntil = e.until; n.bwDrops += 1; }
    const text = describe(e);
    if (text) n.log.unshift({ date: e.date, text });
  }
  n.log = n.log.slice(0, 40);
  return n;
}

/** Judges every finished day not yet judged. Safe to call on every app open: each day is judged once. */
export function catchUp(s: Progress, c: Ctx): { state: Progress; events: Event[] } {
  let state = s;
  const all: Event[] = [];
  let d = s.processedThrough ? addDays(s.processedThrough, 1) : c.schedule.since;
  if (d < c.schedule.since) d = c.schedule.since;
  for (let n = 0; d < c.today && n < 400; n++, d = addDays(d, 1)) {
    const ev = evaluate(d, state, c);
    all.push(...ev);
    state = applyEvents(state, ev);
    state = { ...state, processedThrough: d };
  }
  return { state, events: all };
}

export interface Belt { id: string; name: string; xp: number; color: string }
export const BELTS: Belt[] = [
  { id: 'white', name: 'White', xp: 0, color: '#F2F2F2' },
  { id: 'yellow', name: 'Yellow', xp: 100, color: '#F2C94C' },
  { id: 'green', name: 'Green', xp: 250, color: '#27AE60' },
  { id: 'blue', name: 'Blue', xp: 450, color: '#2D9CDB' },
  { id: 'red', name: 'Red', xp: 700, color: '#EB5757' },
  { id: 'black', name: 'Black', xp: 1000, color: '#1C1C1C' },
];
export function beltFor(bestXp: number): { belt: Belt; next?: Belt; fraction: number } {
  let i = 0;
  BELTS.forEach((b, k) => { if (bestXp >= b.xp) i = k; });
  const belt = BELTS[i], next = BELTS[i + 1];
  return { belt, next, fraction: next ? (bestXp - belt.xp) / (next.xp - belt.xp) : 1 };
}
