/** Clock-based block timer: stores timestamps, never decrements in an interval. */
export class BlockClock {
  durationSec: number;
  private accumulatedMs = 0;
  private runStart: number | null = null;

  constructor(durationSec: number, private now: () => number = () => performance.now()) {
    this.durationSec = durationSec;
  }

  start() { if (this.runStart === null) this.runStart = this.now(); }
  resume() { this.start(); }
  pause() {
    if (this.runStart !== null) { this.accumulatedMs += this.now() - this.runStart; this.runStart = null; }
  }
  get running() { return this.runStart !== null; }
  addSeconds(s: number) { this.durationSec += s; }
  setDuration(s: number) { this.durationSec = s; }

  elapsedSec(): number {
    const ms = this.accumulatedMs + (this.runStart !== null ? this.now() - this.runStart : 0);
    return Math.min(this.durationSec, ms / 1000);
  }
  remainingSec(): number { return Math.max(0, this.durationSec - this.elapsedSec()); }
  isDone(): boolean { return this.elapsedSec() >= this.durationSec; }
}
