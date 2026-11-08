import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockSupabase, newCloud, signIn } from './helpers';

// A fake camera with nobody in it: it lets us run the real recording, saving, uploading and export in a browser.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'], acceptDownloads: true });

const KEN = '11111111-1111-4111-8111-111111111111';

test('the training table lists every exercise and starts empty', async ({ page }) => {
  await page.goto('./#/tuning');
  await expect(page.getByRole('heading', { name: 'Training data' })).toBeVisible();
  await expect(page.getByText('0 of 45 exercises recorded.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Record Front leg swings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Record Bill Wallace routine' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Record next: Front leg swings/ })).toBeVisible();
  await page.getByRole('button', { name: /Only not recorded/ }).click();
  await expect(page.getByRole('link', { name: 'Record Breathing' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/m8-tuning.png', fullPage: true });
});

test('recording an exercise saves it on this phone, uploads it to your account, and shows up in the table and the export', async ({ page }) => {
  test.setTimeout(120000);
  const cloud = newCloud();
  await mockSupabase(page, cloud);
  await signIn(page, 'ken@example.com');
  await page.goto('./#/tuning/hamstring?speed=10&skipwait=1');
  await page.getByRole('button', { name: 'Start recording' }).click();

  // Left leg then right leg. Nobody is in front of the fake camera, so it says so honestly.
  for (const leg of ['left', 'right']) {
    await expect(page.getByText(`Recording, ${leg} leg`)).toBeVisible({ timeout: 90000 });
    await expect(page.getByRole('button', { name: 'Keep this recording' })).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/could not see you|phone|light|not enough/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Keep this recording' }).click();
  }
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.goto('./#/tuning');
  await expect(page.getByText('1 of 45 exercises recorded.')).toBeVisible();
  await expect(page.getByText('2 recordings')).toBeVisible();

  // A copy went to the account, as body points only.
  await expect.poll(() => (cloud.samples[KEN] ?? []).length, { timeout: 20000 }).toBe(2);
  const row = cloud.samples[KEN][0] as { exercise_id: string; frames: number[][] };
  expect(row.exercise_id).toBe('hamstring');
  expect(row.frames.length).toBeGreaterThan(2);
  expect(JSON.stringify(row)).not.toMatch(/data:image|video|blob:/);

  // The export is one file, with no name or email in it.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download my data/ }).click()]);
  expect(dl.suggestedFilename()).toBe('tkd-training-data.json');
  const text = readFileSync(await dl.path(), 'utf8');
  const file = JSON.parse(text);
  expect(file.samples).toHaveLength(2);
  expect(file.app).toBe('tkd-practice');
  expect(text).not.toMatch(/ken@example|@/);
});

test('the guided link in Settings reaches the training data table', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('link', { name: /Training data: record 5 of each exercise/ }).click();
  await expect(page.getByRole('heading', { name: 'Training data' })).toBeVisible();
});
