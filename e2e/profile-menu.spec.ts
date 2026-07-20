import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import type { Database } from '../src/types/database';

const testEmail = 'phase3-profile-menu@example.test';
const testPassword = process.env.E2E_STAFF_PASSWORD ?? 'E2E-only-Profile-Menu!2026';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Authenticated E2E tests require local Supabase environment variables.');
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket as unknown as WebSocketLikeConstructor,
  },
});

let testUserId: string | null = null;

test.beforeAll(async () => {
  await admin.from('staff').delete().eq('email', testEmail);

  const { data: users, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  for (const user of users.users.filter(candidate => candidate.email === testEmail)) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  const { data, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (createError) throw createError;

  testUserId = data.user.id;
  const { error: staffError } = await admin.from('staff').insert({
    user_id: testUserId,
    full_name: 'Faz Üç Yöneticisi',
    email: testEmail,
    role: 'admin',
    is_active: true,
  });
  if (staffError) throw staffError;
});

test.afterAll(async () => {
  if (!testUserId) return;
  await admin.from('staff').delete().eq('user_id', testUserId);
  await admin.auth.admin.deleteUser(testUserId);
});

test('staff can open, close and use the profile menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-posta Adresi' }).fill(testEmail);
  await page.getByLabel('Şifre').fill(testPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();

  await expect(page).toHaveURL('/dashboard');

  const profileButton = page.getByRole('button', { name: 'Profil menüsünü aç' });
  await profileButton.click();

  const profileMenu = page.getByRole('menu', { name: 'Profil seçenekleri' });
  await expect(profileMenu).toBeVisible();
  await expect(profileMenu.getByText('Faz Üç Yöneticisi')).toBeVisible();
  await expect(profileMenu.getByText(testEmail)).toBeVisible();
  await expect(profileMenu.getByText('Yönetici hesabı')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(profileMenu).toBeHidden();

  await profileButton.click();
  await profileMenu.getByRole('menuitem', { name: 'Sistem Ayarları' }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByRole('heading', { name: 'Sistem Ayarları' })).toBeVisible();

  await page.getByRole('button', { name: 'Profil menüsünü aç' }).click();
  await page.getByRole('menuitem', { name: 'Çıkış Yap' }).click();
  await expect(page).toHaveURL('/');
});
