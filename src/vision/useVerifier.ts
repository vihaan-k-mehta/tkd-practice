import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { camMessage, openCamera, stopStream, type CamError } from './camera';
import { Gate, type GateView } from './gate';
import { loadPose, toLandmarks } from './pose';
import { DEFAULT_REP_CONFIG } from './repCounter';
import { Tracker, type Frame } from './tracker';
import type { Lm } from './types';
import { camera } from '../data/library';

export type VerifierStatus = 'off' | 'starting' | 'ready' | 'error';
const INTERVAL_MS = 55; // about 18 frames a second, not every frame

/**
 * Owns the camera, the pose model, the kick counter and the gate for the whole session.
 * Nothing is recorded or uploaded: frames are read, turned into points, and dropped.
 */
export function useVerifier() {
  const [status, setStatus] = useState<VerifierStatus>('off');
  const [error, setError] = useState<string>('');
  const [frame, setFrame] = useState<Frame | null>(null);
  const [gate, setGate] = useState<GateView | null>(null);
  const [delegate, setDelegate] = useState<'GPU' | 'CPU' | ''>('');

  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const tracker = useRef(new Tracker());
  const gateRef = useRef<Gate | null>(null);
  const lmRef = useRef<Lm[] | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const raf = useRef(0);
  const running = useRef(false);
  const lastUi = useRef(0);

  const stop = useCallback(() => {
    running.current = false;
    cancelAnimationFrame(raf.current);
    stopStream(stream.current); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setStatus('off'); setFrame(null); setGate(null);
  }, []);

  /** Point the (possibly re-created) video element at the live stream. */
  const attach = useCallback(() => {
    const v = video.current;
    if (!v || !stream.current) return;
    v.muted = true; v.playsInline = true;
    if (v.srcObject !== stream.current) v.srcObject = stream.current;
    void v.play().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (running.current) return true;
    setStatus('starting'); setError('');
    try {
      const kh = camera.get().kickHeight;
      tracker.current = new Tracker(kh === undefined ? undefined : { ...DEFAULT_REP_CONFIG, kickHeight: kh });
      const [s, pose] = await Promise.all([
        openCamera(),
        loadPose().catch(() => { throw Object.assign(new Error('model'), { kind: 'model' as CamError }); }),
      ]);
      stream.current = s;
      if (!video.current) { stopStream(s); throw Object.assign(new Error('busy'), { kind: 'busy' as CamError }); }
      attach();
      setDelegate(pose.delegate);
      running.current = true;
      let lastRun = 0, lastTime = -1;
      const tick = () => {
        if (!running.current) return;
        const v = video.current;
        const now = performance.now();
        if (v && v.readyState >= 2 && v.currentTime !== lastTime && now - lastRun >= INTERVAL_MS) {
          lastTime = v.currentTime; lastRun = now;
          let lm: Lm[] | null = null;
          try { lm = toLandmarks(pose.landmarker.detectForVideo(v, now)); } catch { lm = null; }
          lmRef.current = lm;
          const f = tracker.current.update(now, lm);
          frameRef.current = f;
          const g = gateRef.current?.update(now, { person: f.inFrame, moving: f.moving });
          if (now - lastUi.current > 100) { lastUi.current = now; setFrame(f); if (g) setGate(g); }
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
      setStatus('ready');
      return true;
    } catch (e) {
      stopStream(stream.current); stream.current = null;
      const kind = ((e as { kind?: CamError }).kind ?? 'busy') as CamError;
      setError(camMessage[kind]); setStatus('error');
      return false;
    }
  }, []);

  /** Start judging a block. Presence for stretches, motion for bag work and drills. */
  const beginBlock = useCallback((mode: 'presence' | 'motion') => {
    tracker.current.reset();
    gateRef.current = new Gate(mode);
    setGate(gateRef.current.state);
  }, []);
  const readGate = useCallback(() => gateRef.current?.state ?? null, []);
  const endBlock = useCallback(() => { const g = gateRef.current?.state ?? null; gateRef.current = null; setGate(null); return g; }, []);

  // The camera must never stay on in the background.
  useEffect(() => {
    let resume = false;
    const onVis = () => {
      if (document.visibilityState === 'hidden') { resume = running.current; stop(); }
      else if (resume) { resume = false; void start(); } // came back: turn the camera on again by itself
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); stop(); };
  }, [stop, start]);

  return { status, error, frame, gate, delegate, video, lmRef, frameRef, tracker, start, stop, attach, beginBlock, endBlock, readGate };
}
export type Verifier = ReturnType<typeof useVerifier>;
