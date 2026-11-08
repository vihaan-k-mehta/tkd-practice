import { useEffect, useRef } from 'preact/hooks';
import type { Verifier } from '../vision/useVerifier';
import { camera } from '../data/library';

const BONES: [number, number][] = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [11, 13], [13, 15], [12, 14], [14, 16]];

/** Small live preview with a status dot and a camera-on label. Nothing is recorded. */
export function CameraPreview({ v, big = false }: { v: Verifier; big?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cam = camera.use();
  const on = v.status === 'ready' || v.status === 'starting';
  const detected = !!v.frame?.present;

  useEffect(() => { v.attach(); }, [v.status]);

  useEffect(() => {
    if (!cam.skeleton || v.status !== 'ready') return;
    let id = 0;
    const draw = () => {
      const c = canvas.current; const vid = v.video.current;
      if (c && vid) {
        c.width = vid.videoWidth || 320; c.height = vid.videoHeight || 240;
        const g = c.getContext('2d')!;
        g.clearRect(0, 0, c.width, c.height);
        const lm = v.lmRef.current;
        if (lm) {
          g.lineWidth = 3; g.strokeStyle = '#7CFC9A'; g.fillStyle = '#7CFC9A';
          for (const [a, b] of BONES) if ((lm[a].v ?? 1) > 0.5 && (lm[b].v ?? 1) > 0.5) { g.beginPath(); g.moveTo(lm[a].x * c.width, lm[a].y * c.height); g.lineTo(lm[b].x * c.width, lm[b].y * c.height); g.stroke(); }
        }
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [cam.skeleton, v.status]);

  return (
    <div class={`pip ${big ? 'big' : ''} ${on ? 'on' : 'off'}`}>
      <video ref={v.video} muted playsInline aria-label="Camera preview" />
      {cam.skeleton && <canvas ref={canvas} aria-hidden="true" />}
      {on && (
        <span class={`pip-status ${detected ? 'ok' : 'search'}`} role="status">
          <i aria-hidden="true" /> {v.status === 'starting' ? 'Starting camera' : detected ? 'Camera on, you are detected' : 'Camera on, searching'}
        </span>
      )}
    </div>
  );
}
