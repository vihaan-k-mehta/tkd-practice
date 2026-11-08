import type { SessionRecord } from '../data/library';

/** Pure schedule logic. Dates are local YYYY-MM-DD strings; weekdays are Monday = 0. */
export interface Slot { id: string; routineId: string; time: string }
export interface Extra { id: string; date: string; routineId: string; time: string }
export interface Move { slotId: string; from: string; to: string }
export interface Schedule {
  /** First day the plan applies to, so earlier days are never counted as missed. */
  since: string;
  weekly: Slot[][];
  extras: Extra[];
  moves: Move[];
  restPass: boolean;
}
export interface Occurrence { slotId: string; routineId: string; time: string; date: string; extra: boolean }
export type DayState = 'rest' | 'planned' | 'done' | 'partial' | 'missed';

const pad = (n: number) => String(n).padStart(2, '0');
const parse = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const weekdayOf = (d: string) => (parse(d).getDay() + 6) % 7;
export const addDays = (d: string, n: number) => { const x = parse(d); x.setDate(x.getDate() + n); return fmt(x); };
const weekStart = (d: string) => addDays(d, -weekdayOf(d));

export function emptySchedule(today: string): Schedule {
  return { since: today, weekly: [[], [], [], [], [], [], []], extras: [], moves: [], restPass: false };
}

export function occurrences(s: Schedule, date: string): Occurrence[] {
  const out: Occurrence[] = [];
  if (date >= s.since) {
    for (const slot of s.weekly[weekdayOf(date)] ?? []) {
      if (s.moves.some((m) => m.slotId === slot.id && m.from === date)) continue;
      out.push({ slotId: slot.id, routineId: slot.routineId, time: slot.time, date, extra: false });
    }
  }
  for (const m of s.moves) {
    if (m.to !== date) continue;
    const slot = s.weekly.flat().find((x) => x.id === m.slotId);
    if (slot) out.push({ slotId: slot.id, routineId: slot.routineId, time: slot.time, date, extra: false });
  }
  for (const e of s.extras) if (e.date === date) out.push({ slotId: e.id, routineId: e.routineId, time: e.time, date, extra: true });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Which occurrences on a date were completed. Each logged session satisfies at most one slot. */
export function doneFlags(occ: Occurrence[], history: SessionRecord[], date: string): boolean[] {
  const pool = history.filter((h) => h.date === date).map((h) => h.routineId);
  return occ.map((o) => { const i = pool.indexOf(o.routineId); if (i < 0) return false; pool.splice(i, 1); return true; });
}

export function dayState(s: Schedule, history: SessionRecord[], date: string, today: string): DayState {
  const occ = occurrences(s, date);
  if (!occ.length) return 'rest';
  const flags = doneFlags(occ, history, date);
  const n = flags.filter(Boolean).length;
  if (n === occ.length) return 'done';
  if (date >= today) return n > 0 ? 'partial' : 'planned';
  return n > 0 ? 'partial' : 'missed';
}

/** Past dates, with sessions planned, not fully completed. These feed the consequence engine. */
export function missedDates(s: Schedule, history: SessionRecord[], today: string): string[] {
  const out: string[] = [];
  for (let d = s.since; d < today; d = addDays(d, 1)) {
    const st = dayState(s, history, d, today);
    if (st === 'missed' || st === 'partial') out.push(d);
  }
  return out;
}

/** Consecutive scheduled days completed. Rest days are skipped. One rest pass per week forgives one miss. */
export function streak(s: Schedule, history: SessionRecord[], today: string): number {
  let count = 0;
  const passUsed = new Set<string>();
  for (let d = today; d >= s.since; d = addDays(d, -1)) {
    const st = dayState(s, history, d, today);
    if (st === 'rest') continue;
    if (st === 'done') { count++; continue; }
    if (d === today && (st === 'planned' || st === 'partial')) continue;
    const wk = weekStart(d);
    if (s.restPass && !passUsed.has(wk)) { passUsed.add(wk); continue; }
    break;
  }
  return count;
}

/** Month grid of dates starting on Monday, whole weeks. `month` is 0-based. */
export function monthGrid(year: number, month: number): string[] {
  const first = fmt(new Date(year, month, 1));
  const last = fmt(new Date(year, month + 1, 0));
  const out: string[] = [];
  for (let d = weekStart(first); d <= addDays(weekStart(last), 6); d = addDays(d, 1)) out.push(d);
  return out;
}

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const esc = (t: string) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

/** iCalendar file with the weekly sessions, each with a reminder 10 minutes before. Floating local times. */
export function toIcs(s: Schedule, routineName: (id: string) => string, from: string, stamp = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TKD Practice//EN', 'CALSCALE:GREGORIAN'];
  const dtstamp = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;
  s.weekly.forEach((slots, wd) => {
    for (const slot of slots) {
      let d = from;
      while (weekdayOf(d) !== wd) d = addDays(d, 1);
      const [hh, mm] = slot.time.split(':');
      lines.push('BEGIN:VEVENT', `UID:${slot.id}@tkd-practice`, `DTSTAMP:${dtstamp}`,
        `DTSTART:${d.replace(/-/g, '')}T${hh}${mm}00`, 'DURATION:PT30M', `RRULE:FREQ=WEEKLY;BYDAY=${DAYS[wd]}`,
        `SUMMARY:${esc(routineName(slot.routineId))}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Time to train', 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT');
    }
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
