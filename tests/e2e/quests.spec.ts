import { test, expect } from '@playwright/test';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const everyDay = () => Array.from({ length: 7 }, (_, i) => [{ id: `s${i}`, routineId: 'quick1', time: '07:00' }]);
const quickRoutine = { id: 'quick1', name: 'Quick hold', blocks: [{ exerciseId: 'calf', target: { seconds: 5 }, sides: 'both' }] };
const prog = (over: object) => ({ xp: 200, bestXp: 200, mode: 'strict', chosen: true, processedThrough: '', passUsed: [], bwDrops: 0, makeUp: 0, forfeited: [], awarded: [], weekFailed: [], bwLocked: [], goals: [], log: [], ...over });

test('missed days are judged once on open, strict mode costs XP and adds a make-up round', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(([routine, sched, pr]) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('tkd.routines.v1', JSON.stringify([routine]));
    localStorage.setItem('tkd.schedule.v1', JSON.stringify(sched));
    localStorage.setItem('tkd.progress.v1', JSON.stringify(pr));
  }, [quickRoutine, { since: ago(2), weekly: everyDay(), extras: [], moves: [], restPass: false }, prog({})] as const);

  await page.goto('./#/today');
  await expect(page.getByText('While you were away')).toBeVisible();
  await expect(page.getByText(/-50 XP, missed session/).first()).toBeVisible();
  await page.screenshot({ path: 'screenshots/m6-today.png', fullPage: true });
  await page.reload();
  await page.goto('./#/quests');
  await expect(page.getByText(/^100 XP/)).toBeVisible(); // two missed days, 200 - 100
  await expect(page.getByText(/2 make-up rounds will be added/)).toBeVisible();
  await page.screenshot({ path: 'screenshots/m6-quests.png', fullPage: true });
  // Reloading did not judge the same days again.
  await page.reload();
  await expect(page.getByText(/^100 XP/)).toBeVisible();
  await ctx.close();
});

test('finishing the scheduled session pays XP and completes the daily quest', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(([routine, sched, pr]) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('tkd.routines.v1', JSON.stringify([routine]));
    localStorage.setItem('tkd.schedule.v1', JSON.stringify(sched));
    localStorage.setItem('tkd.progress.v1', JSON.stringify(pr));
  }, [quickRoutine, { since: ago(0), weekly: everyDay(), extras: [], moves: [], restPass: false }, prog({ xp: 0, bestXp: 0 })] as const);
  await page.goto('./#/session/quick1');
  await page.getByRole('button', { name: 'Play test beep' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Session complete')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('XP earned')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m6-summary.png' });
  await page.goto('./#/quests');
  await expect(page.getByText('Daily quest').first()).toBeVisible();
  await expect(page.locator('li', { hasText: 'Daily quest' }).getByText('Done')).toBeVisible();
  await expect(page.getByText(/^34 XP/)).toBeVisible();
  await ctx.close();
});

test('a strictness change waits for Monday, goals pay once, injury mode pauses penalties', async ({ page }) => {
  await page.goto('./#/quests');
  await page.getByRole('radio', { name: 'Strict' }).click(); // first choice applies now
  await expect(page.getByText(/Changes wait until next Monday/)).toHaveCount(0);
  await page.getByRole('radio', { name: 'Off' }).click();
  await expect(page.getByText(/Changes wait until next Monday/)).toBeVisible();

  await page.getByLabel('New goal').fill('Hold a front split for 30 s');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await page.getByRole('checkbox', { name: 'Hold a front split for 30 s' }).click();
  await expect(page.getByText('25 XP').first()).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Hold a front split for 30 s' })).toBeDisabled();

  await page.getByRole('button', { name: /Pause for 7 days/ }).click();
  await expect(page.getByText(/No penalties and your streak is safe/)).toBeVisible();
  await page.getByRole('button', { name: /end injury mode/ }).click();
  await expect(page.getByRole('button', { name: /Pause for 7 days/ })).toBeVisible();
});
