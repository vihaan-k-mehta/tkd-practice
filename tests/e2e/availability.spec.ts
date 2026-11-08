import { test, expect } from '@playwright/test';

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

test('say when you are free on a weekday and Today adapts to it', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  const name = NAMES[(new Date().getDay() + 6) % 7];
  await page.goto('./#/schedule');
  await page.getByRole('tab', { name: 'Weekly plan' }).click();
  await expect(page.getByRole('button', { name: `${name} availability: Free all day` })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${name} availability`) }).click();
  await page.getByRole('button', { name: 'After 5 pm' }).click();
  await page.getByRole('button', { name: 'Increase Minutes' }).click();
  await page.screenshot({ path: 'screenshots/m5c-avail.png' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: `${name} availability: After 5 pm, 5 min` })).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5c-plan.png', fullPage: true });

  // Today notices the short window and offers the shortened version.
  await page.goto('./#/today');
  await expect(page.getByText('Today you are free: After 5 pm, 5 min.')).toBeVisible();
  await expect(page.getByRole('button', { name: /min version/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Do the full/ })).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5c-today.png' });
  await page.getByRole('button', { name: /min version/ }).click();
  await expect(page.getByRole('heading', { name: 'Check sound' })).toBeVisible();
  await expect(page.getByText('Daily stretch (quick)').first()).toBeVisible();

  // The add-session sheet warns when a time is outside the window.
  await page.goto('./#/schedule');
  await page.getByRole('tab', { name: 'Weekly plan' }).click();
  await page.getByRole('button', { name: `Add a session on ${name}` }).click();
  await page.getByLabel('Time').fill('09:00');
  await expect(page.getByText(/outside the hours you said you are free/)).toBeVisible();
  await expect(page.getByText(/shortened version/)).toBeVisible();
  await ctx.close();
});
