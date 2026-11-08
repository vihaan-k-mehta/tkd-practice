import { test, expect } from '@playwright/test';

const pad = (n: number) => String(n).padStart(2, '0');
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const block = (l: number, r: number, w: number) => ({ exerciseId: 'bill-wallace-routine', name: 'Bill Wallace routine', plannedSec: 600, actualSec: 600, completed: true, weightLb: w, sets: 1, reps: { left: l, right: r, any: 0 } });
const hist = [
  { id: 'a', date: ago(9), routineId: 'bill-wallace', routineName: 'Bill Wallace routine', totalSec: 1200, blocks: [block(20, 18, 1)], holdPeak: 1.0 },
  { id: 'b', date: ago(5), routineId: 'bill-wallace', routineName: 'Bill Wallace routine', totalSec: 1500, blocks: [block(25, 25, 1.5)], holdPeak: 1.2, drops: 2, penalties: 1 },
  { id: 'c', date: ago(4), routineId: 'daily-stretch', routineName: 'Daily stretch', totalSec: 600, blocks: [{ exerciseId: 'hamstring', name: 'Hamstring', plannedSec: 60, actualSec: 60, completed: true }] },
];

test('stats show your totals and draw the graphs from your history', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript((h) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('tkd.history.v1', JSON.stringify(h));
    localStorage.setItem('tkd.progress.v1', JSON.stringify({ xp: 120, bestXp: 120, mode: 'light', chosen: true, weights: { 'bill-wallace-routine': 1.5 } }));
  }, hist);
  await page.goto('./#/today');
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await expect(page.locator('.tile', { hasText: 'Sessions' }).locator('b')).toHaveText('3');
  await expect(page.locator('.tile', { hasText: 'Kicks thrown' }).locator('b')).toHaveText('88');
  await expect(page.locator('.tile', { hasText: 'Minutes' }).locator('b')).toHaveText('55');
  await expect(page.locator('.tile', { hasText: 'lb now' }).locator('b')).toHaveText('1.5');
  await expect(page.getByText(/Foot touched down 2 times in total, 1 not fixed/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Total kicks thrown\. Latest 88 kicks/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Ankle weight over time\. Latest 1\.5 lb/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Left 45, Right 43/ })).toBeVisible();
  await page.screenshot({ path: 'screenshots/m8-stats.png', fullPage: true });
  await page.locator('details.chart-table summary').first().click();
  await expect(page.locator('.chart-table table').first()).toBeVisible();
  await ctx.close();
});

test('with no sessions the stats screen is calm and empty, not broken', async ({ page }) => {
  await page.goto('./#/stats');
  await expect(page.getByText(/No sessions yet/)).toBeVisible();
  await expect(page.getByText('Nothing to show yet.').first()).toBeVisible();
});
