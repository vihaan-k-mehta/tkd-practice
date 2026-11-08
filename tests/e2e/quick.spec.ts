import { test, expect } from '@playwright/test';

test('short on time: pick minutes, get a quick version that still counts as the daily routine', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('./#/today');
  await page.getByRole('button', { name: 'Short on time?' }).click();
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await expect(page.getByText('Daily stretch (quick)')).toBeVisible();
  await expect(page.getByText(/Left out:/)).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5b-time.png' });
  await page.getByRole('button', { name: 'Start the quick version' }).click();
  await expect(page.getByRole('heading', { name: 'Check sound' })).toBeVisible();
  await expect(page.getByText('Daily stretch (quick)').first()).toBeVisible();

  // A gear-heavy template with plenty of time stays whole.
  await page.goto('./#/today');
  await page.getByRole('button', { name: 'Short on time?' }).click();
  await page.getByRole('button', { name: '45 min', exact: true }).click();
  await expect(page.getByText(/already fits/)).toBeVisible();
  await ctx.close();
});
