import { useEffect, useState } from 'preact/hooks';

export type Route = 'today' | 'routines' | 'schedule' | 'quests' | 'ranks' | 'settings';
const routes: Route[] = ['today', 'routines', 'schedule', 'quests', 'ranks', 'settings'];

function read(): Route {
  const h = location.hash.replace(/^#\/?/, '') as Route;
  return routes.includes(h) ? h : 'today';
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(read());
  useEffect(() => {
    const on = () => setR(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}
