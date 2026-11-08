import { useEffect, useState } from 'preact/hooks';

export type Route = 'today' | 'routines' | 'schedule' | 'quests' | 'ranks' | 'settings' | 'session' | 'routine' | 'animations' | 'debug-pose' | 'train';
const routes: Route[] = ['today', 'routines', 'schedule', 'quests', 'ranks', 'settings', 'session', 'routine', 'animations', 'debug-pose', 'train'];
export interface Loc { name: Route; id?: string }

function read(): Loc {
  const [n0, id] = location.hash.replace(/^#\/?/, '').split('/');
  const n = (n0 ?? '').split('?')[0];
  let safeId: string | undefined;
  try { safeId = id ? decodeURIComponent(id).slice(0, 80) : undefined; } catch { safeId = undefined; } // a malformed %-escape must not crash the app
  return { name: routes.includes(n as Route) ? (n as Route) : 'today', id: safeId };
}

export function useLoc(): Loc {
  const [l, setL] = useState<Loc>(read());
  useEffect(() => {
    const on = () => setL(read());
    on(); // catch a change that happened between the first render and now
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return l;
}
export const go = (path: string) => { location.hash = `/${path}`; };
