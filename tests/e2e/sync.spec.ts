import { test, expect } from '@playwright/test';
import { mockSupabase, newCloud, signIn } from './helpers';

const KEN = '11111111-1111-4111-8111-111111111111', AMY = '22222222-2222-4222-8222-222222222222';
const local = () => ({
  h: JSON.parse(localStorage.getItem('tkd.history.v1') || '[]').length,
  w: JSON.parse(localStorage.getItem('tkd.progress.v1') || '{}').weights,
  c: JSON.parse(localStorage.getItem('tkd.camera.v1') || '{}').motionThreshold,
});

test('your data follows your login to a second phone, and a different account on the same phone stays separate', async ({ browser }) => {
  const cloud = newCloud();

  // Phone A has local sessions, a weight and a tuned camera. Signing in as Ken sends it all up.
  const a = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await mockSupabase(a, cloud);
  await a.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('tkd.history.v1', JSON.stringify([
      { id: 's1', date: '2026-11-02', routineId: 'bill-wallace', routineName: 'Bill Wallace routine', totalSec: 600, blocks: [] },
      { id: 's2', date: '2026-11-03', routineId: 'bill-wallace', routineName: 'Bill Wallace routine', totalSec: 600, blocks: [] },
    ]));
    localStorage.setItem('tkd.progress.v1', JSON.stringify({ xp: 90, bestXp: 90, mode: 'light', chosen: true, weights: { 'bill-wallace-routine': 1.5 } }));
    localStorage.setItem('tkd.camera.v1', JSON.stringify({ use: true, motionThreshold: 0.11, sensitivity: 'normal' }));
  });
  await signIn(a, 'ken@example.com');
  await expect(a.getByText(/Saved \d/)).toBeVisible({ timeout: 15000 });
  expect(cloud.sessions[KEN].map((s) => s.id).sort()).toEqual(['s1', 's2']);
  const saved = cloud.settings[KEN].data as { progress: { weights: Record<string, number> }; camera: { motionThreshold: number } };
  expect(saved.progress.weights['bill-wallace-routine']).toBe(1.5);
  expect(saved.camera.motionThreshold).toBe(0.11);
  expect(JSON.stringify(cloud)).not.toMatch(/password/i);

  // Phone B is brand new. Ken signs in and gets everything back.
  const b = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await mockSupabase(b, cloud);
  await signIn(b, 'ken@example.com');
  await expect(b.getByText(/Saved \d/)).toBeVisible({ timeout: 15000 });
  expect(await b.evaluate(local)).toEqual({ h: 2, w: { 'bill-wallace-routine': 1.5 }, c: 0.11 });

  // Ken signs out of phone B and Amy (a different account, nothing in the cloud) signs in.
  // Ken's data must be gone from this phone and never uploaded as Amy's.
  await b.getByRole('button', { name: /Sign out/ }).click();
  await b.getByLabel('Email').fill('amy@example.com');
  await b.getByLabel('Password').fill('blue-kick-fast-7');
  await b.locator('form button[type=submit]').click();
  await expect(b.getByText(/Saved \d/)).toBeVisible({ timeout: 15000 });
  const amy = await b.evaluate(local);
  expect(amy.h).toBe(0);
  expect(amy.w ?? {}).toEqual({});
  expect(amy.c).toBeUndefined();
  expect(cloud.sessions[AMY] ?? []).toEqual([]);
  expect(cloud.sessions[KEN]).toHaveLength(2);
});

test('a change made while signed in is saved to the cloud by itself', async ({ browser }) => {
  const cloud = newCloud();
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await mockSupabase(p, cloud);
  await signIn(p, 'ken@example.com');
  await expect(p.getByText(/Saved \d/)).toBeVisible({ timeout: 15000 });
  await p.getByRole('radio', { name: 'Strict' }).click();
  await expect.poll(() => (cloud.settings[KEN].data as { camera: { sensitivity: string } }).camera.sensitivity, { timeout: 15000 }).toBe('strict');
});
