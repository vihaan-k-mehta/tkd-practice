import { useEffect, useState } from 'preact/hooks';

export type Route = 'today' | 'routines' | 'schedule' | 'quests' | 'ranks' | 'settings' | 'session' | 'routine' | 'animations' | 'debug-pose';
const routes: Route[] = ['today', 'routines', 'schedule', 'quests', 'ranks', 'settings', 'session', 'routine', 'animations', 'debug-pose'];
export interface Loc { name: Route; id?: string }

function read(): Loc {
  const [n, id] = location.hash.replace(/^#\/?/, '').split('/');
  let safeId: string | undefined;
  try { safeId = id ? decodeURIComponent(id).slice(0, 80) : undefined; } catch { safeId = undefined; } // a malformed %-escape must not crash the app
  return { name: routes.includes(n as Route) ? (n as Route) : 'today', id: safeId };
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
