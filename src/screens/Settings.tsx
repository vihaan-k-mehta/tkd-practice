import { useState } from 'preact/hooks';
import { Play } from 'lucide-preact';
import { Header } from './Today';
import { setAlerts, useAlerts } from '../data/settings';
import { PRESETS, parseSeconds, type BeepType, type VibrateMode } from '../engine/alerts';
import { audio, vibrate, vibrationSupported } from '../engine/audio';
import { camera, equipment } from '../data/library';
import { Account } from './Account';
import { EQUIPMENT_LABEL, type Equipment } from '../data/types';

const beepTypes: { id: BeepType; label: string }[] = [
  { id: 'tick', label: 'Short tick' }, { id: 'double', label: 'Double beep' }, { id: 'triple', label: 'Triple beep' },
  { id: 'low', label: 'Low tone' }, { id: 'high', label: 'High tone' }, { id: 'bell', label: 'Bell' }, { id: 'sweep', label: 'Rising sweep' },
];

function Toggle({ label, on, set, hint }: { label: string; on: boolean; set: (v: boolean) => void; hint?: string }) {
  return (
    <li>
      <div class="grow"><div>{label}</div>{hint && <div class="sub">{hint}</div>}</div>
      <button class={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)}><span /></button>
    </li>
  );
}

export function Settings() {
  const a = useAlerts();
  const own = equipment.use();
  const cam = camera.use();
  const [times, setTimes] = useState(a.atSecondsRemaining.join(', '));
  const preview = async (t: BeepType) => { await audio.unlock(); audio.setVolume(a.volume); audio.play(t); };
  const commitTimes = (v: string) => { setTimes(v); setAlerts({ atSecondsRemaining: parseSeconds(v) }); };
  const preset = (list: readonly number[]) => commitTimes(list.join(', '));
  const isPreset = (list: readonly number[]) => a.atSecondsRemaining.join() === list.join();

  return (
    <main class="screen">
      <Header title="Settings" />
      <p class="sub">Alert defaults for every timer.</p>

      <p class="eyebrow">Account</p>
      <Account />

      <p class="eyebrow">Camera check</p>
      <ul class="rowlist">
        <Toggle label="Use the camera on checked blocks" on={cam.use} set={(v) => camera.set((c) => ({ ...c, use: v }))} hint="Stretches check you are in view, bag work checks you are moving, kicks are counted." />
        <Toggle label="Honor mode" on={cam.honor} set={(v) => camera.set((c) => ({ ...c, honor: v }))} hint="Skip the camera for bad light or a broken camera. Sessions are marked unverified, earn half XP and stay off leaderboards." />
        <Toggle label="Show skeleton overlay" on={cam.skeleton} set={(v) => camera.set((c) => ({ ...c, skeleton: v }))} hint="For debugging only." />
      </ul>
      <a class="btn-primary" href="#/train" style={{ textDecoration: 'none', marginTop: '10px' }}>Guided training (about 2 minutes)</a>
      <p class="sub note">Follow a voice through a few exercises. It tunes the camera to you and reports back.</p>
      <a class="btn-ghost" href="#/tuning" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginTop: '10px' }}>Training data: record 5 of each exercise</a>
      <p class="sub note">Record every exercise once and the camera is tuned to how you do each one. Recordings are body points only and save to your account.</p>
      <p class="eyebrow">How strict is the camera</p>
      <div class="seg-row" role="radiogroup" aria-label="Camera sensitivity" style={{ marginTop: '0px' }}>
        {(['relaxed', 'normal', 'strict'] as const).map((s) => (
          <button class={`seg ${cam.sensitivity === s ? 'on' : ''}`} role="radio" aria-checked={cam.sensitivity === s} onClick={() => camera.set((c) => ({ ...c, sensitivity: s }))}>{s[0].toUpperCase() + s.slice(1)}</button>
        ))}
      </div>
      <p class="sub note">Relaxed forgives short dropouts and slow movement, and only needs part of you in view. Strict follows the original rules: whole body, quick to pause.</p>
      <p class="eyebrow">Tracking quality</p>
      <div class="seg-row" role="radiogroup" aria-label="Tracking quality" style={{ marginTop: '0px' }}>
        <button class={`seg ${cam.quality === 'full' ? 'on' : ''}`} role="radio" aria-checked={cam.quality === 'full'} onClick={() => camera.set((c) => ({ ...c, quality: 'full' }))}>Accurate</button>
        <button class={`seg ${cam.quality === 'lite' ? 'on' : ''}`} role="radio" aria-checked={cam.quality === 'lite'} onClick={() => camera.set((c) => ({ ...c, quality: 'lite' }))}>Fast</button>
      </div>
      <p class="sub note">Accurate follows you better, including on the floor, but needs a newer phone. Switch to Fast if it feels slow.</p>
      {cam.motionThreshold !== undefined && <button class="btn-ghost" onClick={() => camera.set((c) => ({ ...c, motionThreshold: undefined }))}>Forget my movement training</button>}
      <p class="sub note">Video stays on this phone. Nothing is recorded or sent. A single camera can confirm you are in view, moving and throwing real kicks. It cannot judge fine technique, so it is not a coach.</p>
      {cam.kickHeight !== undefined && <button class="btn-ghost" onClick={() => camera.set((c) => ({ ...c, kickHeight: undefined }))}>Reset kick height calibration</button>}

      <p class="eyebrow">Equipment I own</p>
      <ul class="rowlist">
        {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => (
          <Toggle label={EQUIPMENT_LABEL[k]} on={own[k]} set={(v) => equipment.set((o) => ({ ...o, [k]: v }))} />
        ))}
      </ul>

      <p class="eyebrow">Alert times</p>
      <div class="seg-row" style={{ marginTop: '0px' }}>
        <button class={`seg ${isPreset(PRESETS.lastTen) ? 'on' : ''}`} onClick={() => preset(PRESETS.lastTen)}>Last 10 s</button>
        <button class={`seg ${isPreset(PRESETS.countdown5) ? 'on' : ''}`} onClick={() => preset(PRESETS.countdown5)}>Count down 5</button>
      </div>
      <label class="eyebrow" for="times">Seconds remaining, comma separated</label>
      <input id="times" class="field" inputMode="numeric" value={times} onInput={(e) => commitTimes((e.target as HTMLInputElement).value)} placeholder="30, 10" />

      <ul class="rowlist">
        <Toggle label="Halfway beep" on={a.halfway} set={(v) => setAlerts({ halfway: v })} />
        <Toggle label="Beep at block start" on={a.beepOnStart} set={(v) => setAlerts({ beepOnStart: v })} />
        <Toggle label="Beep at block end" on={a.beepOnEnd} set={(v) => setAlerts({ beepOnEnd: v })} />
        <Toggle label="Long bell at end" on={a.endSound} set={(v) => setAlerts({ endSound: v })} />
        <Toggle label="Different beep, rest to work" on={a.restToWorkChange} set={(v) => setAlerts({ restToWorkChange: v })} />
      </ul>

      <p class="eyebrow">Beep sound</p>
      <ul class="rowlist">
        {beepTypes.map((b) => (
          <li>
            <button class={`pick ${a.beepType === b.id ? 'on' : ''}`} onClick={() => setAlerts({ beepType: b.id })} aria-pressed={a.beepType === b.id}>
              <span class="radio" />{b.label}
            </button>
            <button class="icon-btn" aria-label={`Preview ${b.label}`} onClick={() => preview(b.id)}><Play size={22} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>

      <p class="eyebrow">Volume</p>
      <div class="panel">
        <input type="range" min="0" max="100" value={Math.round(a.volume * 100)} aria-label="Alert volume"
          onInput={(e) => { const v = Number((e.target as HTMLInputElement).value) / 100; setAlerts({ volume: v }); audio.setVolume(v); }} />
        <div class="two">
          <b>{Math.round(a.volume * 100)} percent</b>
          <button class="select" onClick={() => preview('bell')}>Test sound<Play size={20} aria-hidden="true" /></button>
        </div>
      </div>
      <p class="sub note">This sets the app's loudness only. Your phone's volume and silent switch still apply, and a website can't read them.</p>

      {vibrationSupported() && (
        <>
          <p class="eyebrow">Vibration</p>
          <div class="seg-row" style={{ marginTop: '0px' }}>
            {(['off', 'short', 'double', 'long'] as VibrateMode[]).map((m) => (
              <button class={`seg ${a.vibrate === m ? 'on' : ''}`} onClick={() => { setAlerts({ vibrate: m }); vibrate(m); }}>{m[0].toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
