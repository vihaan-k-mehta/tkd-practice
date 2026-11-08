import { useEffect, useState } from 'preact/hooks';

export type Route = 'today' | 'routines' | 'schedule' | 'quests' | 'ranks' | 'settings' | 'session' | 'routine';
const routes: Route[] = ['today', 'routines', 'schedule', 'quests', 'ranks', 'settings', 'session', 'routine'];
export interface Loc { name: Route; id?: string }

function read(): Loc {
  const [n, id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: routes.includes(n as Route) ? (n as Route) : 'today', id: id ? decodeURIComponent(id) : undefined };
}

export function useLoc(): Loc {
  const [l, setL] = useState<Loc>(read());
  useEffect(() => {
    const on = () => setL(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return l;
}
export const go = (path: string) => { location.hash = `/${path}`; };
