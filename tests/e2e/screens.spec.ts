import { test, expect } from '@playwright/test';

const sizes = [{ w: 390, h: 844 }, { w: 360, h: 800 }];
for (const s of sizes) for (const scheme of ['light', 'dark'] as const) {
  test(`today and session ${s.w}x${s.h} ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: scheme, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('./');
    await expect(page.getByRole('link', { name: 'Start session' })).toBeVisible();
    await page.screenshot({ path: `screenshots/today-${s.w}x${s.h}-${scheme}.png` });
    await page.getByRole('link', { name: 'Start session' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page.screenshot({ path: `screenshots/session-${s.w}x${s.h}-${scheme}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await ctx.close();
  });
}
