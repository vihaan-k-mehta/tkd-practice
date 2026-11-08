import { describe, expect, it } from 'vitest';
import { applyBundle, bundleOf, decideSettings, mergeSessions, type Bundle } from '../src/data/syncRules';
import { freshProgress } from '../src/engine/quests';
import { emptySchedule } from '../src/engine/schedule';
import type { SessionRecord } from '../src/data/library';

const rec = (id: string, date: string): SessionRecord => ({ id, date, routineId: 'r', routineName: 'R', totalSec: 60, blocks: [] });

describe('mergeSessions: never lose a session, never duplicate one', () => {
  it('keeps the union, newest first', () => {
    const m = mergeSessions([rec('a', '2026-11-02'), rec('b', '2026-11-04')], [rec('b', '2026-11-04'), rec('c', '2026-11-03')]);
    expect(m.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
  it('prefers the local copy of a session that exists in both', () => {
    const local = { ...rec('a', '2026-11-02'), totalSec: 999 };
    expect(mergeSessions([local], [rec('a', '2026-11-02')])[0].totalSec).toBe(999);
  });
  it('drops malformed remote rows instead of crashing', () => {
    const m = mergeSessions([], [{ id: 'x' } as unknown as SessionRecord, null as unknown as SessionRecord, rec('ok', '2026-11-01')]);
    expect(m.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('decideSettings: who wins when this device and the cloud disagree', () => {
  const base = { owner: 'u1' as string | null, user: 'u1', hasRemote: true, remoteAt: 2000, syncedAt: 1000, changedAt: 500 };
  it('first time ever: nothing in the cloud means upload what is here', () => expect(decideSettings({ ...base, hasRemote: false })).toBe('push'));
  it('same account, nothing changed here, cloud is newer: take the cloud copy', () => expect(decideSettings(base)).toBe('pull'));
  it('same account, changed here since the last sync: this device wins', () => expect(decideSettings({ ...base, changedAt: 1500 })).toBe('push'));
  it('same account, cloud not newer: nothing to do', () => expect(decideSettings({ ...base, remoteAt: 900 })).toBe('none'));
  it('a different account was using this device: wipe it and take the new account', () => expect(decideSettings({ ...base, owner: 'someone-else' })).toBe('wipe-then-pull'));
  it('a different account on a phone, with nothing in the cloud yet: wipe and start fresh, never upload the other persons data', () => expect(decideSettings({ ...base, owner: 'someone-else', hasRemote: false })).toBe('wipe'));
  it('a first sign-in on a device with local data and an account that already has data: the account wins', () => expect(decideSettings({ ...base, owner: null })).toBe('pull'));
  it('a first sign-in with local data and a brand new account: adopt the local data', () => expect(decideSettings({ ...base, owner: null, hasRemote: false })).toBe('push'));
});

describe('bundle: what is saved per user, cleaned on the way back in', () => {
  const state = { camera: { use: true, honor: false, skeleton: false, sensitivity: 'normal' as const, quality: 'lite' as const, motionThreshold: 0.12 }, progress: { ...freshProgress('2026-11-02'), xp: 77, weights: { 'bill-wallace-routine': 1.5 } }, schedule: emptySchedule('2026-11-02'), routines: [], equipment: { ankleWeights: true, bands: false, heavyBag: true, rope: true, box: true } };
  it('round-trips', () => {
    const b = bundleOf(state, 123);
    expect(b.updatedAt).toBe(123);
    expect(applyBundle(JSON.parse(JSON.stringify(b)) as Bundle).progress.weights['bill-wallace-routine']).toBe(1.5);
  });
  it('contains no video and no landmark frames', () => {
    expect(JSON.stringify(bundleOf(state, 1))).not.toMatch(/frames|landmark|video/i);
  });
  it('cleans a tampered cloud copy: bad numbers and ids are dropped or clamped', () => {
    const evil = { updatedAt: 1, camera: { sensitivity: 'banana', motionThreshold: 9999 }, progress: { xp: -5, weights: { '<x>': 3, 'bill-wallace-routine': 9999 } }, routines: [{ id: '<x>', name: 'a', blocks: [] }] } as unknown as Bundle;
    const out = applyBundle(evil);
    expect(out.camera.sensitivity).toBe('relaxed');
    expect(out.camera.motionThreshold).toBeLessThanOrEqual(0.5);
    expect(out.progress.xp).toBe(0);
    expect(Object.keys(out.progress.weights)).toEqual(['bill-wallace-routine']);
    expect(out.progress.weights['bill-wallace-routine']).toBeLessThanOrEqual(50);
    expect(out.routines).toEqual([]);
  });
  it('survives rubbish', () => {
    expect(() => applyBundle(null as unknown as Bundle)).not.toThrow();
    expect(applyBundle(null as unknown as Bundle).progress.xp).toBe(0);
  });
});
