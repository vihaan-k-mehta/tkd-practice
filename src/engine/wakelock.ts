type Sentinel = { release(): Promise<void> };

/** Holds a screen wake lock while active and re-requests it when the page becomes visible again. */
export function keepAwake(): () => void {
  let sentinel: Sentinel | null = null;
  let stopped = false;
  const request = async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Sentinel> } }).wakeLock;
      if (wl && !stopped) sentinel = await wl.request('screen');
    } catch { /* denied or unsupported: the timer still works */ }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
  document.addEventListener('visibilitychange', onVisible);
  void request();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => {});
  };
}

/** Whether this browser can keep the screen on by itself. */
export const wakeLockSupported = (): boolean => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
