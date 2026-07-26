import { expect, test } from '@playwright/test';

test('login page exposes the staff sign-in form', async ({ page }) => {
  const response = await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Nobel Vize CRM' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-posta Adresi' })).toBeVisible();
  await expect(page.getByLabel('Şifre')).toBeVisible();
  expect(response?.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
});

test('anonymous users are redirected away from protected pages', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Hoş Geldiniz' })).toBeVisible();
});

test('removed public pricing route returns not found', async ({ request }) => {
  const response = await request.get('/pricing');

  expect(response.status()).toBe(404);
});

test('unsigned Google Form webhook requests are rejected', async ({ request }) => {
  const response = await request.post('/api/webhook/google-form', { data: {} });

  expect(response.status()).toBe(401);
  expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
});

test('health endpoints expose only minimal service state', async ({ request }) => {
  const live = await request.get('/api/health/live');
  expect(live.status()).toBe(200);
  expect(live.headers()['cache-control']).toContain('no-store');
  expect(live.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(live.json()).resolves.toMatchObject({
    status: 'ok',
    service: 'nobel-vize-crm',
  });

  const ready = await request.get('/api/health/ready');
  expect([200, 503]).toContain(ready.status());
  expect(ready.headers()['cache-control']).toContain('no-store');
  expect(ready.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  const payload = await ready.json() as Record<string, unknown>;
  expect(['ready', 'unavailable']).toContain(payload.status);
  expect(payload).not.toHaveProperty('checks');
  expect(payload).not.toHaveProperty('errorCodes');
});
