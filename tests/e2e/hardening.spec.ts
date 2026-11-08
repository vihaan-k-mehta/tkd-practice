import { test, expect } from '@playwright/test';

test('no CSP violations or page errors across the main screens, and a malformed link does not crash', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || /content security policy/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  for (const r of ['today', 'routines', 'schedule', 'settings', 'session/daily-stretch', 'animations', 'quests', 'debug-pose', 'session/%E0%A4%A']) {
    await page.goto(`./#/${r}`);
    await page.waitForTimeout(300);
  }
  await expect(page.locator('main')).toBeVisible();
  expect(problems).toEqual([]);
});

test('tampered saved data is ignored instead of crashing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tkd.routines.v1', JSON.stringify([{ id: '<x>', name: 'a', blocks: [] }, 'junk', { id: 'ok', name: '<b>hi</b>', blocks: [{ exerciseId: 'zzz' }] }]));
    localStorage.setItem('tkd.schedule.v1', '{"weekly":"nope"}');
  });
  await page.goto('./#/routines');
  await expect(page.getByText('<b>hi</b>')).toBeVisible();
  await page.goto('./#/schedule');
  await expect(page.getByText('Day streak')).toBeVisible();
});

test('animation contact sheet', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 700, height: 900 }, colorScheme: 'light' })).newPage();
  await page.goto('./#/animations');
  await page.screenshot({ path: 'screenshots/anim-sheet.png', fullPage: true });
});
