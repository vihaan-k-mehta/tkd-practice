import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_ALERTS, type AlertConfig } from '../engine/alerts';

const KEY = 'tkd.alerts.v1';
let current: AlertConfig = load();
const subs = new Set<() => void>();

function load(): AlertConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_ALERTS, ...JSON.parse(raw) };
  } catch { /* storage blocked */ }
  return { ...DEFAULT_ALERTS };
}

export const getAlerts = () => current;
export function setAlerts(patch: Partial<AlertConfig>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function useAlerts(): AlertConfig {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  return current;
}
