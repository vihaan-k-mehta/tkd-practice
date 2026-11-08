import { useEffect } from 'preact/hooks';
import { useLoc } from './router';
import { history, localDate, notice, progress, schedule } from '../data/library';
import { catchUp } from '../engine/quests';
import { Quests } from '../screens/Quests';
import { TabBar } from './TabBar';
import { Today } from '../screens/Today';
import { SessionScreen } from '../screens/Session';
import { Routines } from '../screens/Routines';
import { RoutineBuilder } from '../screens/RoutineBuilder';
import { Placeholder } from '../screens/Placeholder';
import { SchedulePage } from '../screens/Schedule';
import { AnimSheet } from '../screens/AnimSheet';
import { Settings } from '../screens/Settings';

/** Judges any finished, unjudged days. Each day is judged once, so running it often is safe. */
function judgeDays() {
  const { state, events } = catchUp(progress.get(), { schedule: schedule.get(), history: history.get(), today: localDate() });
  if (state === progress.get()) return;
  progress.set(() => state);
  const lines = events.flatMap((e) => (e.type === 'xp' && e.delta < 0 ? [`${e.delta} XP, missed session on ${e.date}`] : e.type === 'forfeit' ? [`Daily quest forfeited for ${e.date}`] : e.type === 'makeup' ? ['A make-up round will be added to your next session'] : e.type === 'passUsed' ? [`Rest pass covered a missed session on ${e.date}`] : e.type === 'weekFail' ? ['Weekly quest failed, two misses'] : []));
  if (lines.length) notice.set(() => ({ lines: lines.slice(0, 8) }));
}

export function App() {
  useEffect(() => {
    judgeDays();
    const on = () => { if (document.visibilityState === 'visible') judgeDays(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const { name, id } = useLoc();
  const tab = name === 'routine' ? 'routines' : name;
  return (
    <>
      <div class="blobs" aria-hidden="true" />
      {name === 'today' && <Today />}
      {name === 'session' && <SessionScreen key={id} id={id} />}
      {name === 'routines' && <Routines />}
      {name === 'routine' && <RoutineBuilder key={id} id={id} />}
      {name === 'schedule' && <SchedulePage />}
      {name === 'quests' && <Quests />}
      {name === 'ranks' && <Placeholder title="Ranks" note="No group yet." />}
      {name === 'settings' && <Settings />}
      {name === 'animations' && <AnimSheet />}
      {name !== 'session' && <TabBar route={tab} />}
    </>
  );
}
