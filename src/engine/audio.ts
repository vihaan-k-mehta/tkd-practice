import type { BeepType, VibrateMode } from './alerts';

/** Synthesised beeps on the Web Audio clock. One AudioContext, created on the first tap. */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.8;

  /** Must be called from a user gesture the first time. */
  async unlock(): Promise<boolean> {
    try {
      // iOS: treat page audio as media so the ring/silent switch does not mute it (Safari 16.4+).
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this.master!.gain.value = this.volume;
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  get state(): 'none' | 'running' | 'suspended' {
    if (!this.ctx) return 'none';
    return this.ctx.state === 'running' ? 'running' : 'suspended';
  }
  get now(): number { return this.ctx?.currentTime ?? 0; }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  /** Schedule a beep `delaySec` from now on the audio clock. */
  play(type: BeepType, delaySec = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + Math.max(0, delaySec);
    const tone = (freq: number, start: number, dur: number, opts: { type?: OscillatorType; peak?: number; endFreq?: number } = {}) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = opts.type ?? 'sine';
      osc.frequency.setValueAtTime(freq, t0 + start);
      if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + start + dur);
      const peak = opts.peak ?? 0.9;
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(g); g.connect(this.master!);
      osc.start(t0 + start); osc.stop(t0 + start + dur + 0.02);
    };
    switch (type) {
      case 'tick': tone(1200, 0, 0.07, { type: 'square', peak: 0.5 }); break;
      case 'double': tone(990, 0, 0.09, { type: 'square', peak: 0.5 }); tone(990, 0.14, 0.09, { type: 'square', peak: 0.5 }); break;
      case 'triple': [0, 0.12, 0.24].forEach((s) => tone(1100, s, 0.08, { type: 'square', peak: 0.5 })); break;
      case 'low': tone(330, 0, 0.35, { type: 'triangle' }); break;
      case 'high': tone(1760, 0, 0.3, { type: 'triangle', peak: 0.7 }); break;
      case 'bell': tone(880, 0, 1.1); tone(2200, 0, 0.7, { peak: 0.35 }); tone(1320, 0, 0.9, { peak: 0.3 }); break;
      case 'sweep': tone(400, 0, 0.35, { type: 'sawtooth', peak: 0.4, endFreq: 1800 }); break;
    }
  }
}

export const audio = new AudioEngine();

export function vibrate(mode: VibrateMode) {
  if (mode === 'off' || !('vibrate' in navigator)) return;
  navigator.vibrate(mode === 'short' ? 80 : mode === 'double' ? [80, 60, 80] : 400);
}
export const vibrationSupported = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;
