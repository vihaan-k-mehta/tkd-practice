import { useLoc } from './router';
import { TabBar } from './TabBar';
import { Today } from '../screens/Today';
import { SessionScreen } from '../screens/Session';
import { Routines } from '../screens/Routines';
import { RoutineBuilder } from '../screens/RoutineBuilder';
import { Placeholder } from '../screens/Placeholder';
import { SchedulePage } from '../screens/Schedule';
import { AnimSheet } from '../screens/AnimSheet';
import { Settings } from '../screens/Settings';

export function App() {
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
      {name === 'quests' && <Placeholder title="Quests" note="No quests yet." />}
      {name === 'ranks' && <Placeholder title="Ranks" note="No group yet." />}
      {name === 'settings' && <Settings />}
      {name === 'animations' && <AnimSheet />}
      {name !== 'session' && <TabBar route={tab} />}
    </>
  );
}
