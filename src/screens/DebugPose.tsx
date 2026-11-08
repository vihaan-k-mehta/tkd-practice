import { useState } from 'preact/hooks';
import { loadPose, toLandmarks } from '../vision/pose';
import { Tracker } from '../vision/tracker';
import type { Lm } from '../vision/types';

interface Row { t: number; side: string; peak: number }
const STEP_MS = 1000 / 15;

/** Hidden page: run the kick counter on a video you pick, or on a saved landmark file, and print the counts. Nothing is uploaded. */
export function DebugPose() {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ left: number; right: number; frames: number; found: number; rows: Row[] } | null>(null);
  const [err, setErr] = useState('');

  const finish = (tr: Tracker, frames: number, found: number, rows: Row[]) => setOut({ ...tr.reps, frames, found, rows });

  const fromVideo = async (file: File) => {
    setBusy(true); setErr(''); setOut(null);
    const url = URL.createObjectURL(file);
    try {
      const { landmarker } = await loadPose();
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.src = url;
      await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Could not read that video.')); });
      const tr = new Tracker();
      const rows: Row[] = []; let frames = 0, found = 0;
      for (let t = 0; t < v.duration * 1000; t += STEP_MS) {
        v.currentTime = t / 1000;
        await new Promise<void>((r) => { v.onseeked = () => r(); });
        const lm = toLandmarks(landmarker.detectForVideo(v, t + 1));
        const f = tr.update(t, lm);
        frames++; if (lm) found++;
        f.newReps.forEach((n) => rows.push({ t: Math.round(t), side: n.side, peak: Number(n.peakHeight.toFixed(2)) }));
      }
      finish(tr, frames, found, rows);
    } catch (e) { setErr((e as Error).message || 'Something went wrong.'); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  };

  const fromJson = async (file: File) => {
    setBusy(true); setErr(''); setOut(null);
    try {
      const clip = JSON.parse(await file.text()) as { t: number; lm: Lm[] }[];
      if (!Array.isArray(clip)) throw new Error('Expected a list of {t, lm} frames.');
      const tr = new Tracker();
      const rows: Row[] = [];
      clip.forEach((fr) => tr.update(fr.t, fr.lm).newReps.forEach((n) => rows.push({ t: Math.round(fr.t), side: n.side, peak: Number(n.peakHeight.toFixed(2)) })));
      finish(tr, clip.length, clip.length, rows);
    } catch (e) { setErr((e as Error).message || 'Could not read that file.'); }
    finally { setBusy(false); }
  };

  return (
    <main class="screen">
      <h1>Pose debug</h1>
      <p class="sub">Runs the kick counter on a file on this device. Nothing is uploaded.</p>
      <label class="eyebrow" for="dv">Video file</label>
      <input id="dv" class="field" type="file" accept="video/*" disabled={busy} onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void fromVideo(f); }} />
      <label class="eyebrow" for="dj">Landmark JSON, a list of frames like {'{ "t": 0, "lm": [ {x, y, v}, ... 33 points ] }'}</label>
      <input id="dj" class="field" type="file" accept="application/json,.json" disabled={busy} onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void fromJson(f); }} />
      {busy && <p class="sub note" role="status">Working...</p>}
      {err && <p class="sub note warn" role="alert">{err}</p>}
      {out && (
        <section aria-live="polite">
          <div class="tiles" style={{ marginTop: '16px' }}>
            <div class="tile"><b data-testid="left">{out.left}</b><span>Left kicks</span></div>
            <div class="tile"><b data-testid="right">{out.right}</b><span>Right kicks</span></div>
          </div>
          <p class="sub note">{out.found} of {out.frames} frames had a person.</p>
          <ul class="rowlist">{out.rows.map((r) => <li><span class="grow">{r.side} kick at {(r.t / 1000).toFixed(1)} s</span><span class="sub">height {r.peak}</span></li>)}</ul>
        </section>
      )}
    </main>
  );
}
