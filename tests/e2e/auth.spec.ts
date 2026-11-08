import { test, expect } from '@playwright/test';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', exp: 4102444800 })}.sig`;
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'ken@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-11-08T00:00:00Z' };
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user };

test('create an account, set a name, sign out, sign back in (Supabase mocked)', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) problems.push(m.text()); });
  let signupBody = '', loginBody = '', upsertBody = '';
  await page.route('**/auth/v1/signup**', async (r) => { signupBody = r.request().postData() ?? ''; await r.fulfill({ status: 200, json: session }); });
  await page.route('**/auth/v1/token**', async (r) => { loginBody = r.request().postData() ?? ''; await r.fulfill({ status: 200, json: session }); });
  await page.route('**/auth/v1/logout**', (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/rest/v1/profiles**', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, json: { display_name: 'Ken' } });
    upsertBody = r.request().postData() ?? ''; return r.fulfill({ status: 201, body: '' });
  });

  await page.goto('./#/settings');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill('not an email');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await page.getByLabel('Email').fill('Ken@Example.com');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Use at least 10 characters.')).toBeVisible();
  await page.getByLabel('Password').fill('kenkenken123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Do not use your email name in your password.')).toBeVisible();

  await page.getByLabel('Password').fill('blue-kick-fast-7');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Signed in')).toBeVisible();
  expect(JSON.parse(signupBody)).toMatchObject({ email: 'ken@example.com', password: 'blue-kick-fast-7' });

  await page.getByLabel('Name on the leaderboard').fill('  Ken\u0000 the kicker that is far too long  ');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  expect(JSON.parse(upsertBody).display_name.length).toBeLessThanOrEqual(20);

  await page.getByRole('button', { name: /Sign out/ }).click();
  await page.getByRole('tab', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill('ken@example.com');
  await page.getByLabel('Password').fill('blue-kick-fast-7');
  await page.locator('form button[type=submit]').click();
  await expect(page.getByText('Signed in')).toBeVisible();
  expect(JSON.parse(loginBody)).toMatchObject({ email: 'ken@example.com' });
  expect(problems).toEqual([]);
});

test('wrong passwords give one vague message, then sign-in pauses for a minute', async ({ page }) => {
  await page.route('**/auth/v1/token**', (r) => r.fulfill({ status: 400, json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }));
  await page.goto('./#/settings');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByLabel('Password').fill('wrong-password-1');
  for (let i = 0; i < 5; i++) await page.locator('form button[type=submit]').click();
  await expect(page.getByText('That email and password did not match.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
  await page.goto('./#/today');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('landing from a confirmation email: no stuck page, URL cleaned, clear next step', async ({ page }) => {
  await page.route('**/auth/v1/token**', (r) => r.fulfill({ status: 400, json: { code: 400, error_code: 'flow_state_not_found', msg: 'no verifier here' } }));
  await page.goto('./?code=abc123#/today');
  await expect(page.getByText('Your email is confirmed. Sign in with your email and password.')).toBeVisible();
  expect(page.url()).not.toContain('code=');
  expect(page.url()).toContain('#/settings');

  await page.goto('./?error=access_denied&error_code=otp_expired#/today');
  await expect(page.getByText(/confirmation link did not work or has expired/)).toBeVisible();
});

test('sign-up asks for the confirmation link to come back to this app, not localhost', async ({ page }) => {
  let url = '';
  await page.route('**/auth/v1/signup**', async (r) => { url = r.request().url(); await r.fulfill({ status: 200, json: { id: 'x', email: 'a@b.co', aud: 'authenticated' } }); });
  await page.goto('./#/settings');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password').fill('blue-kick-fast-7');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/Check your email to confirm/)).toBeVisible();
  expect(decodeURIComponent(url)).toContain('redirect_to=http://localhost:4173/tkd-practice/');
});
