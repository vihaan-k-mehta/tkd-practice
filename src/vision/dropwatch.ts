export type DropEvent = 'alarm' | 'penalty' | 'cleared';
export interface DropConfig { confirmMs: number; graceMs: number; liftMs: number }
export const DROP_CONFIG: DropConfig = { confirmMs: 600, graceMs: 4000, liftMs: 300 };

/**
 * Watches one leg that must stay up. If the foot has been down for 0.6 s it raises the alarm (fast beeping).
 * If it is still down 4 s later it is a penalty. Lifting the foot clears it. A drop that is fixed in time costs nothing.
 * `planted === null` means the camera cannot tell, which is never a drop.
 */
export class DropWatch {
  drops = 0;
  penalties = 0;
  private plantedSince: number | null = null;
  private liftedSince: number | null = null;
  private alarmSince: number | null = null;
  private penalised = false;
  constructor(private cfg: DropConfig = DROP_CONFIG) {}

  reset() { this.plantedSince = this.liftedSince = this.alarmSince = null; this.penalised = false; }

  update(tMs: number, planted: boolean | null, enabled: boolean): { alarm: boolean; event?: DropEvent } {
    if (!enabled) { this.reset(); return { alarm: false }; }
    if (planted === true) {
      this.liftedSince = null;
      this.plantedSince ??= tMs;
      if (this.alarmSince === null && tMs - this.plantedSince >= this.cfg.confirmMs) {
        this.alarmSince = tMs; this.drops++;
        return { alarm: true, event: 'alarm' };
      }
      if (this.alarmSince !== null && !this.penalised && tMs - this.alarmSince >= this.cfg.graceMs) {
        this.penalised = true; this.penalties++;
        return { alarm: true, event: 'penalty' };
      }
      return { alarm: this.alarmSince !== null };
    }
    // lifted or unknown
    this.plantedSince = null;
    if (this.alarmSince !== null) {
      this.liftedSince ??= tMs;
      if (planted === false && tMs - this.liftedSince >= this.cfg.liftMs) { this.alarmSince = null; this.penalised = false; this.liftedSince = null; return { alarm: false, event: 'cleared' }; }
      return { alarm: true };
    }
    return { alarm: false };
  }
}
