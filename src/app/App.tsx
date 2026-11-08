import { useRoute } from './router';
import { TabBar } from './TabBar';
import { Today } from '../screens/Today';
import { Placeholder } from '../screens/Placeholder';

export function App() {
  const route = useRoute();
  return (
    <>
      {route === 'today' && <Today />}
      {route === 'routines' && <Placeholder title="Routines" note="No routines yet. The routine builder comes in a later milestone." />}
      {route === 'schedule' && <Placeholder title="Schedule" note="Nothing scheduled. The weekly plan comes in a later milestone." />}
      {route === 'quests' && <Placeholder title="Quests" note="No quests yet." />}
      {route === 'ranks' && <Placeholder title="Ranks" note="No group yet." />}
      {route === 'settings' && <Placeholder title="Settings" note="Settings come with the alerts milestone." />}
      <TabBar route={route} />
    </>
  );
}
