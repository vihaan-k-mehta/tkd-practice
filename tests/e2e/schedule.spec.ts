import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

test('plan the week, see it on Today and the calendar, export to calendar', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', acceptDownloads: true });
  const page = await ctx.newPage();
  const now = new Date();
  const wd = (now.getDay() + 6) % 7;

  await page.goto('./#/schedule');
  await expect(page.getByText('Nothing scheduled yet')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5-empty.png' });

  await page.getByRole('tab', { name: 'Weekly plan' }).click();
  await page.getByRole('button', { name: `Add a session on ${NAMES[wd]}` }).click();
  await page.getByLabel('Routine').selectOption('daily-stretch');
  await page.getByLabel('Time').fill('18:30');
  await page.getByRole('button', { name: 'Add session' }).click();
  await expect(page.getByText('18:30')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5-plan.png', fullPage: true });

  // Today reads from the schedule.
  await page.goto('./#/today');
  await expect(page.getByText('Planned for 18:30')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5-today.png' });

  // Calendar marks today as planned and opens a day sheet.
  await page.goto('./#/schedule');
  const today = ymd(now);
  await expect(page.locator(`[data-date="${today}"]`)).toHaveAttribute('aria-label', /today, planned/);
  await page.locator(`[data-date="${today}"]`).click();
  await expect(page.getByText('18:30')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m5-day.png' });

  // Export.
  await page.reload();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Add to calendar' }).click()]);
  expect(dl.suggestedFilename()).toBe('tkd-practice.ics');
  const text = readFileSync(await dl.path(), 'utf8');
  expect(text).toContain('BEGIN:VEVENT');
  expect(text).toContain('18:30'.replace(':', '') + '00');
  await ctx.close();
});

test('a missed past session shows as missed and a logged one extends the streak', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const since = new Date(now); since.setDate(since.getDate() - 3);
  const weekly = [[], [], [], [], [], [], []].map((_, i) => [{ id: `s${i}`, routineId: 'daily-stretch', time: '07:00' }]);
  await page.addInitScript(([sched, hist]) => {
    localStorage.setItem('tkd.schedule.v1', JSON.stringify(sched));
    localStorage.setItem('tkd.history.v1', JSON.stringify(hist));
  }, [
    { since: ymd(since), weekly, extras: [], moves: [], restPass: false },
    [{ id: 'h1', date: ymd(y), routineId: 'daily-stretch', routineName: 'Daily stretch', totalSec: 600, blocks: [] }],
  ] as const);
  await page.goto('./#/schedule');
  await expect(page.locator(`[data-date="${ymd(y)}"]`)).toHaveAttribute('aria-label', /done/);
  const twoAgo = new Date(now); twoAgo.setDate(twoAgo.getDate() - 2);
  // Only check the calendar if the older day is in the visible month.
  if (twoAgo.getMonth() === now.getMonth()) await expect(page.locator(`[data-date="${ymd(twoAgo)}"]`)).toHaveAttribute('aria-label', /missed/);
  await expect(page.getByText('Day streak')).toBeVisible();
  await page.goto('./#/today');
  await expect(page.getByText('Missed in the last 7 days')).toBeVisible();
  await ctx.close();
});
