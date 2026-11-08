import { useRoute } from './router';
import { TabBar } from './TabBar';
import { Today } from '../screens/Today';
import { SessionScreen } from '../screens/Session';
import { Placeholder } from '../screens/Placeholder';
import { Settings } from '../screens/Settings';

export function App() {
  const route = useRoute();
  return (
    <>
      <div class="blobs" aria-hidden="true" />
      {route === 'today' && <Today />}
      {route === 'session' && <SessionScreen />}
      {route === 'routines' && <Placeholder title="Routines" note="No routines yet. The routine builder comes in a later milestone." />}
      {route === 'schedule' && <Placeholder title="Schedule" note="Nothing scheduled. The weekly plan comes in a later milestone." />}
      {route === 'quests' && <Placeholder title="Quests" note="No quests yet." />}
      {route === 'ranks' && <Placeholder title="Ranks" note="No group yet." />}
      {route === 'settings' && <Settings />}
      {route !== 'session' && <TabBar route={route} />}
    </>
  );
}
