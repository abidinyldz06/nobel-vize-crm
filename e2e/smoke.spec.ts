import { expect, test } from '@playwright/test';

test('login page exposes the staff sign-in form', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Nobel Vize CRM' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'E-posta Adresi' })).toBeVisible();
  await expect(page.getByLabel('Şifre')).toBeVisible();
});

test('anonymous users are redirected away from protected pages', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Hoş Geldiniz' })).toBeVisible();
});

test('public pricing page renders without authentication', async ({ page }) => {
  await page.goto('/pricing');

  await expect(page.getByRole('heading', { name: /Vize Danışmanlık Süreçlerinizi/ })).toBeVisible();
  await expect(page.getByText('₺1.499')).toBeVisible();
});

test('unsigned Google Form webhook requests are rejected', async ({ request }) => {
  const response = await request.post('/api/webhook/google-form', { data: {} });

  expect(response.status()).toBe(401);
});
