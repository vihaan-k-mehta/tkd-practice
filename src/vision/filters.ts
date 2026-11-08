/** One Euro filter: smooths jitter when still, but follows fast movement closely. */
export class OneEuro {
  private x?: number; private dx = 0; private t?: number;
  constructor(private minCutoff = 1.5, private beta = 6, private dCutoff = 1) {}
  private alpha(cutoff: number, dt: number) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(value: number, tMs: number): number {
    if (this.x === undefined || this.t === undefined) { this.x = value; this.t = tMs; return value; }
    const dt = Math.max(0.001, (tMs - this.t) / 1000);
    const rawD = (value - this.x) / dt;
    const ad = this.alpha(this.dCutoff, dt);
    this.dx = this.dx + ad * (rawD - this.dx);
    const a = this.alpha(this.minCutoff + this.beta * Math.abs(this.dx), dt);
    this.x = this.x + a * (value - this.x);
    this.t = tMs;
    return this.x;
  }
  reset() { this.x = undefined; this.t = undefined; this.dx = 0; }
}
