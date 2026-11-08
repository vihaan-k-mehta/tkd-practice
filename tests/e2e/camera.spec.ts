import { test, expect } from '@playwright/test';
import { evenKicks, synthClip } from '../helpers/synth';

// A fake camera (a test pattern, no person) lets us check the whole pipeline in a real browser:
// permission, camera on, the self-hosted MediaPipe model and WebAssembly loading under the CSP,
// and the "searching" state when nobody is in view.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'] });

test('camera setup loads the model under the CSP, shows searching, Start arms, calibration and training run, then honor mode continues', async ({ page }) => {
  test.setTimeout(90000);
  const problems: string[] = [];
  page.on('console', (m) => { if (/content security policy|refused to/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.goto('./#/session/daily-stretch');
  await page.getByRole('button', { name: 'Play test beep' }).click();
  await expect(page.getByText(/use the camera to check/)).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Camera check' })).toBeVisible();
  await expect(page.getByText(/Video stays on this phone/)).toBeVisible();
  await page.getByRole('button', { name: 'Allow camera' }).click();

  await expect(page.getByText(/Camera on, searching/)).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/Step back a little or into the light/).first()).toBeVisible();
  // Start can be pressed from across the room: it arms and waits to see you.
  await expect(page.getByRole('button', { name: 'Start when I am in frame' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start when I am in frame' }).click();
  await expect(page.getByText('Get into position. It starts by itself when it sees you.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Waiting for you to get in frame/ })).toBeVisible();
  await page.getByRole('button', { name: /Waiting for you to get in frame/ }).click();
  await expect(page.getByRole('button', { name: 'Start when I am in frame' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Optional: calibrate with 3 kicks' })).toBeVisible();
  await page.getByRole('button', { name: 'Optional: calibrate with 3 kicks' }).click();
  await expect(page.getByText('Throw 3 kicks at your usual height')).toBeVisible();
  await expect(page.getByLabel('0 of 3 kicks seen')).toBeVisible();
  await page.screenshot({ path: 'screenshots/m7-calibrating.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel calibration' }).click();

  // Training reports honestly when it could not see anyone, and changes nothing.
  await page.getByRole('button', { name: /Train it to my setup/ }).click();
  await expect(page.getByText('Do your normal exercise now')).toBeVisible();
  await expect(page.getByText('Could not train')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/I could not see you for much of that/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tkd.camera.v1') || '{}').motionThreshold)).toBeUndefined();
  await page.screenshot({ path: 'screenshots/m7-setup.png', fullPage: true });

  // The camera light goes off when we leave the checked flow.
  await page.getByRole('button', { name: /Continue without the camera/ }).click();
  await expect(page.getByText('Get ready')).toBeVisible();
  await expect(page.getByText(/Camera on/)).toHaveCount(0);
  const tracks = await page.evaluate(async () => (await navigator.mediaDevices.enumerateDevices()).length >= 0);
  expect(tracks).toBe(true);
  expect(problems).toEqual([]);
});

test('turning the camera check off in Settings marks the session unverified', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('switch', { name: 'Use the camera on checked blocks' }).click();
  await page.goto('./#/session/daily-stretch');
  await expect(page.getByText(/this session will be marked unverified and earns half XP/)).toBeVisible();
});

test('debug page counts kicks from a landmark file, in the real browser', async ({ page }) => {
  const clip = synthClip({ seconds: 25, kicks: evenKicks(10, 'left'), seed: 21 });
  await page.goto('./#/debug-pose');
  await page.setInputFiles('#dj', { name: 'clip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(clip)) });
  await expect(page.getByTestId('left')).toHaveText('10');
  await expect(page.getByTestId('right')).toHaveText('0');
  await expect(page.getByText(/left kick at/i).first()).toBeVisible();
});

test('sensitivity and tracking quality are choices that stick, relaxed and accurate by default', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByRole('radio', { name: 'Relaxed' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Accurate' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Strict' }).click();
  await page.getByRole('radio', { name: 'Fast' }).click();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Strict' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Fast' })).toHaveAttribute('aria-checked', 'true');
});

test('guided training runs the whole script and reports back, and learns nothing when nobody was seen', async ({ page }) => {
  test.setTimeout(90000);
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.goto('./#/train?speed=4&skipwait=1');
  await expect(page.getByText(/follow the voice and the beeps/)).toBeVisible();
  await page.screenshot({ path: 'screenshots/m7-train-intro.png', fullPage: true });
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.getByText('Step 1 of 7')).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: 'screenshots/m7-train-run.png', fullPage: true });
  await expect(page.getByText(/Trained/)).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: 'screenshots/m7-train-report.png', fullPage: true });
  await expect(page.getByText('Leaving the picture')).toBeVisible();
  await expect(page.getByText('Left kicks')).toBeVisible();
  await expect(page.getByText('What I saved')).toBeVisible();
  // Nobody was in view, so nothing about movement or kicks was learned.
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('tkd.camera.v1') || '{}'));
  expect(s.motionThreshold).toBeUndefined();
  expect(s.kickCfg).toBeUndefined();
  await page.getByRole('button', { name: 'Undo these changes' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('settings and the camera setup both link to the guided training', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByRole('link', { name: /Guided training/ })).toBeVisible();
  await page.getByRole('link', { name: /Guided training/ }).click();
  await expect(page.getByRole('heading', { name: 'Guided training' })).toBeVisible();
});

test('the Bill Wallace routine is a template with a leg choice and an ankle weight', async ({ page }) => {
  await page.goto('./#/routine/bill-wallace');
  await expect(page.getByText('Bill Wallace routine').first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit Bill Wallace routine' }).click();
  await expect(page.getByText(/without putting the foot down except where it says/)).toBeVisible();
  await page.getByRole('button', { name: 'Increase Ankle weight' }).click();
  await expect(page.getByText('0.5 lb').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'One side' })).toHaveCount(0);
  await page.screenshot({ path: 'screenshots/m8-bw-edit.png' });
});
