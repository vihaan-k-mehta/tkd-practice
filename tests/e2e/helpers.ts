import type { Page } from '@playwright/test';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
export interface Cloud {
  settings: Record<string, { data: unknown; updated_at: string }>;
  sessions: Record<string, { id: string; date: string; payload: unknown }[]>;
  samples: Record<string, { id: string; exercise_id: string; expected: number; frames: unknown }[]>;
  users: Record<string, string>;
}
export const newCloud = (): Cloud => ({ settings: {}, sessions: {}, samples: {}, users: { 'ken@example.com': '11111111-1111-4111-8111-111111111111', 'amy@example.com': '22222222-2222-4222-8222-222222222222' } });

/** A tiny fake of Supabase (auth and the tables), shared by every page you give it. */
export async function mockSupabase(page: Page, cloud: Cloud) {
  const uidFrom = (url: string) => /user_id=eq\.([0-9a-f-]+)/.exec(url)?.[1] ?? '';
  await page.route('**/auth/v1/token**', async (r) => {
    const body = JSON.parse(r.request().postData() ?? '{}');
    const id = cloud.users[body.email];
    if (!id) return r.fulfill({ status: 400, json: { error_code: 'invalid_credentials', msg: 'no' } });
    const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: id, aud: 'authenticated', role: 'authenticated', exp: 4102444800 })}.s`;
    return r.fulfill({ status: 200, json: { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: { id, aud: 'authenticated', role: 'authenticated', email: body.email, app_metadata: {}, user_metadata: {}, created_at: '2026-11-08T00:00:00Z' } } });
  });
  await page.route('**/auth/v1/logout**', (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/rest/v1/profiles**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, json: [] }) : r.fulfill({ status: 201, body: '' })));
  await page.route('**/rest/v1/user_settings**', async (r) => {
    if (r.request().method() === 'GET') { const row = cloud.settings[uidFrom(r.request().url())]; return r.fulfill({ status: 200, json: row ? [row] : [] }); }
    const b = JSON.parse(r.request().postData() ?? '{}');
    cloud.settings[b.user_id] = { data: b.data, updated_at: b.updated_at };
    return r.fulfill({ status: 201, body: '' });
  });
  await page.route('**/rest/v1/sessions**', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, json: cloud.sessions[uidFrom(r.request().url())] ?? [] });
    const rows = JSON.parse(r.request().postData() ?? '[]') as { user_id: string; id: string; date: string; payload: unknown }[];
    for (const x of rows) { const list = (cloud.sessions[x.user_id] ??= []); const i = list.findIndex((y) => y.id === x.id); if (i >= 0) list[i] = x; else list.push(x); }
    return r.fulfill({ status: 201, body: '' });
  });
  await page.route('**/rest/v1/training_samples**', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ status: 200, json: cloud.samples[uidFrom(r.request().url())] ?? [] });
    const body = JSON.parse(r.request().postData() ?? '[]');
    const rows = (Array.isArray(body) ? body : [body]) as { user_id: string; id: string; exercise_id: string; expected: number; frames: unknown }[];
    for (const x of rows) { const list = (cloud.samples[x.user_id] ??= []); const i = list.findIndex((y) => y.id === x.id); if (i >= 0) list[i] = x; else list.push(x); }
    return r.fulfill({ status: 201, body: '' });
  });
}

export async function signIn(page: Page, email: string) {
  await page.goto('./#/settings');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('blue-kick-fast-7');
  await page.locator('form button[type=submit]').click();
  await page.getByText('Signed in').first().waitFor();
}
