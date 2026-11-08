import { useEffect, useState } from 'preact/hooks';

/** Tiny persistent store: localStorage-backed, subscribable, safe if storage is blocked. */
export function createStore<T>(key: string, initial: T, clean?: (parsed: unknown, initial: T) => T) {
  let cur: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw && clean) cur = clean(JSON.parse(raw), initial);
    else if (raw) cur = typeof initial === 'object' && !Array.isArray(initial) ? { ...initial, ...JSON.parse(raw) } : JSON.parse(raw);
  } catch { /* use defaults */ }
  const subs = new Set<() => void>();
  const get = () => cur;
  const set = (fn: (v: T) => T) => {
    cur = fn(cur);
    try { localStorage.setItem(key, JSON.stringify(cur)); } catch { /* ignore */ }
    subs.forEach((f) => f());
  };
  const use = (): T => {
    const [, tick] = useState(0);
    useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
    return cur;
  };
  return { get, set, use };
}
