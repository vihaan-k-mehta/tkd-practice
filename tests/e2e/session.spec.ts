import { test, expect } from '@playwright/test';

test('session: check sound, ready countdown beeps on the audio clock, hold runs, settings persist', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    (window as any).__beeps = [];
    const orig = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      (window as any).__beeps.push({ when: when ?? 0, f: (this as any).frequency.value });
      return orig.call(this, when);
    };
  });
  await page.goto('./#/session/daily-stretch');
  await page.screenshot({ path: 'screenshots/m3-check.png' });
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Play test beep' }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => (window as any).__beeps.length);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /seconds remaining/);
  await page.screenshot({ path: 'screenshots/m3-ready.png' });
  await expect(page.getByText('Left side')).toBeVisible({ timeout: 9000 });
  await page.screenshot({ path: 'screenshots/m4-reps.png' });

  // Ready countdown: ticks at +2, +3, +4 and the high tone at +5, gaps must be 1 s within 50 ms.
  const beeps: { when: number; f: number }[] = await page.evaluate(() => (window as any).__beeps.slice());
  const w = beeps.slice(before).map((b) => b.when);
  expect(w.length).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < 4; i++) expect(Math.abs(w[i] - w[i - 1] - 1)).toBeLessThan(0.05);

  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Count down 5' }).click();
  await page.screenshot({ path: 'screenshots/m3-settings.png', fullPage: true });
  await page.reload();
  await expect(page.getByLabel(/Seconds remaining/)).toHaveValue('5, 4, 3, 2, 1');
  await ctx.close();
});
