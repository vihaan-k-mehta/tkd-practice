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
