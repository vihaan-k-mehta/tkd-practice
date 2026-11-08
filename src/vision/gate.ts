export type GateState = 'verified' | 'searching' | 'idle' | 'resuming' | 'failed';
export interface GateView { state: GateState; running: boolean; verifiedMs: number; pausedMs: number; message: string }

const GAP_AFTER = 1500, SEARCH_AFTER = 1000, IDLE_AFTER = 5000, RESUME_AFTER = 500, FAIL_AFTER = 60000;

/**
 * Decides whether a verified block's timer may run.
 * Presence mode needs a person in view. Motion mode also needs movement.
 */
export class Gate {
  state: GateView = { state: 'verified', running: true, verifiedMs: 0, pausedMs: 0, message: '' };
  private last?: number;
  private personAt?: number;      // last time a person was seen
  private movedAt?: number;       // last time movement was seen
  private okSince?: number;       // when conditions became good again after a pause
  constructor(private mode: 'presence' | 'motion') {}

  update(tMs: number, input: { person: boolean; moving: boolean }): GateView {
    let dt = this.last === undefined ? 0 : Math.max(0, tMs - this.last);
    this.last = tMs;
    // Frames normally arrive every ~50 ms. A big gap means the camera was not watching, so none of it counts as verified.
    if (dt > GAP_AFTER && this.state.state !== 'failed') {
      this.state = { ...this.state, state: 'searching', running: false, pausedMs: this.state.pausedMs + dt, message: 'Step back so your whole body is in view.' };
      this.okSince = undefined; this.personAt = undefined; dt = 0;
      if (this.state.pausedMs > FAIL_AFTER) this.state = { ...this.state, state: 'failed', message: 'The camera could not see you for too long. This block was not completed.' };
    }
    if (this.personAt === undefined) { this.personAt = tMs; this.movedAt = tMs; }
    if (input.person) this.personAt = tMs;
    if (input.person && input.moving) this.movedAt = tMs;
    const s = this.state;
    if (s.state === 'failed') return s;

    const lostPerson = tMs - this.personAt > SEARCH_AFTER;
    const stale = this.mode === 'motion' && tMs - (this.movedAt ?? tMs) > IDLE_AFTER;
    const good = input.person && (this.mode === 'presence' || input.moving);

    let next = s.state, message = s.message;
    if (s.state === 'verified') {
      if (lostPerson) { next = 'searching'; message = 'Step back so your whole body is in view.'; }
      else if (stale) { next = 'idle'; message = 'Keep moving.'; }
    } else if (s.state === 'searching' || s.state === 'idle') {
      if (good) { next = 'resuming'; this.okSince = tMs; message = 'Detected, one moment...'; }
    } else if (s.state === 'resuming') {
      if (!good) { next = lostPerson ? 'searching' : 'idle'; message = next === 'searching' ? 'Step back so your whole body is in view.' : 'Keep moving.'; this.okSince = undefined; }
      else if (tMs - (this.okSince ?? tMs) >= RESUME_AFTER) { next = 'verified'; message = ''; this.movedAt = tMs; this.personAt = tMs; }
    }

    const running = next === 'verified';
    const verifiedMs = s.verifiedMs + (s.running && running ? dt : 0);
    const pausedMs = s.pausedMs + (!running ? dt : 0);
    if (pausedMs > FAIL_AFTER) {
      this.state = { state: 'failed', running: false, verifiedMs, pausedMs, message: 'The camera could not see you for too long. This block was not completed.' };
    } else this.state = { state: next, running, verifiedMs, pausedMs, message };
    return this.state;
  }
}
