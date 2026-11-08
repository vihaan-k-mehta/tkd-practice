import { test, expect } from '@playwright/test';

test('build a routine, save it, run it start to finish, see the summary', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('./#/routines');
  await page.screenshot({ path: 'screenshots/m4-routines.png' });

  await page.getByRole('button', { name: 'New routine' }).click();
  await page.getByLabel('Name').fill('Quick test');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByPlaceholder('Search exercises').fill('front leg');
  await page.getByRole('button', { name: 'Front leg swings', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByPlaceholder('Search exercises').fill('calf');
  await page.getByRole('button', { name: 'Calf stretch', exact: true }).click();

  await page.getByRole('button', { name: 'Edit Calf stretch' }).click();
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Decrease Seconds' }).click();
  await page.screenshot({ path: 'screenshots/m4-edit.png' });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('5 s per side')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m4-builder.png', fullPage: true });

  await page.getByRole('button', { name: 'Save routine' }).click();
  await expect(page.getByText('Routine saved')).toBeVisible();

  await page.getByRole('button', { name: 'Start session' }).click();
  await page.getByRole('button', { name: 'Play test beep' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // Block 1: reps, left then right.
  await expect(page.getByText(/Left side/)).toBeVisible({ timeout: 9000 });
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Count a rep' }).click();
  await page.getByRole('button', { name: 'Finish early' }).click();
  await expect(page.getByText(/Right side/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish early' }).click();

  // Block 2: ready then a 5 s hold on each side with a switch.
  await expect(page.getByText('Get ready')).toBeVisible();
  await expect(page.getByText('Left side')).toBeVisible({ timeout: 9000 });
  await expect(page.getByText('Right side')).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('2 of 2')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m4-summary.png', fullPage: true });

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Quick test, ')).toBeVisible();
  await page.goto('./#/routines');
  await expect(page.getByText('Quick test')).toBeVisible();
  await ctx.close();
});

test('exercise library filters by equipment and partner', async ({ page }) => {
  await page.goto('./#/routines');
  await page.getByRole('tab', { name: 'Exercises' }).click();
  await expect(page.getByText('Heavy bag', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Solo only' }).click();
  await expect(page.getByText('Point sparring rounds')).toHaveCount(0);
  await page.goto('./#/settings');
  await page.getByRole('switch', { name: 'Heavy bag' }).click();
  await page.goto('./#/routines');
  await page.getByRole('tab', { name: 'Exercises' }).click();
  await expect(page.getByText('Roundhouse rounds')).toHaveCount(0);
  await page.screenshot({ path: 'screenshots/m4-library.png', fullPage: true });
});
