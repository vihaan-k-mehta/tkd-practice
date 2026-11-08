import { test, expect } from '@playwright/test';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', exp: 4102444800 })}.sig`;
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'ken@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-11-08T00:00:00Z' };

test('sign in with an emailed code, set a name, sign out (Supabase mocked)', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) problems.push(m.text()); });
  let otpBody = '', verifyBody = '', upsertBody = '';
  await page.route('**/auth/v1/otp**', async (r) => { otpBody = r.request().postData() ?? ''; await r.fulfill({ status: 200, json: {} }); });
  await page.route('**/auth/v1/verify**', async (r) => { verifyBody = r.request().postData() ?? ''; await r.fulfill({ status: 200, json: { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user } }); });
  await page.route('**/auth/v1/logout**', (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/rest/v1/profiles**', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, json: { display_name: 'Ken' } });
    upsertBody = r.request().postData() ?? ''; return r.fulfill({ status: 201, body: '' });
  });

  await page.goto('./#/settings');
  await page.getByLabel('Email').fill('not an email');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();

  await page.getByLabel('Email').fill('Ken@Example.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByText(/emailed you a code/)).toBeVisible();
  expect(JSON.parse(otpBody).email).toBe('ken@example.com');
  await expect(page.getByRole('button', { name: /Send again in/ })).toBeDisabled();

  await page.getByLabel('6-digit code').fill('12ab');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('The code is 6 to 8 digits.')).toBeVisible();

  await page.getByLabel('6-digit code').fill('123 456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Signed in')).toBeVisible();
  expect(JSON.parse(verifyBody)).toMatchObject({ token: '123456', type: 'email', email: 'ken@example.com' });

  await page.getByLabel('Name on the leaderboard').fill('  Ken\u0000 the kicker that is far too long  ');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  expect(JSON.parse(upsertBody).display_name.length).toBeLessThanOrEqual(20);

  await page.getByRole('button', { name: /Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('a failed or rate-limited send shows a kind message and the app keeps working', async ({ page }) => {
  await page.route('**/auth/v1/otp**', (r) => r.fulfill({ status: 429, json: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' } }));
  await page.goto('./#/settings');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByText(/Too many tries/)).toBeVisible();
  await page.goto('./#/today');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});
