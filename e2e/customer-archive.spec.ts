import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import type { Database } from '../src/types/database';

const testEmail = 'h2-customer-archive@example.test';
const testPassword = process.env.E2E_STAFF_PASSWORD ?? 'E2E-only-Customer-Archive!2026';
const customerEmail = 'h2-archive-customer@example.test';
const customerName = 'H2 Arşiv Müşterisi';

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
let testStaffId: string | null = null;
let testCustomerId: string | null = null;

test.beforeAll(async () => {
  await admin.from('customers').delete().eq('email', customerEmail);
  await admin.from('staff').delete().eq('email', testEmail);

  const { data: users, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  for (const user of users.users.filter(candidate => candidate.email === testEmail)) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (createError) throw createError;

  testUserId = authData.user.id;
  const { data: staff, error: staffError } = await admin
    .from('staff')
    .insert({
      user_id: testUserId,
      full_name: 'H2 Arşiv Yöneticisi',
      email: testEmail,
      role: 'admin',
      is_active: true,
    })
    .select('id')
    .single();
  if (staffError) throw staffError;

  testStaffId = staff.id;
  const { data: customer, error: customerError } = await admin
    .from('customers')
    .insert({
      first_name: 'H2 Arşiv',
      last_name: 'Müşterisi',
      email: customerEmail,
      phone: '05550000022',
      assigned_staff_id: testStaffId,
    })
    .select('id')
    .single();
  if (customerError) throw customerError;

  testCustomerId = customer.id;
});

test.afterAll(async () => {
  if (testCustomerId) {
    await admin.from('customers').delete().eq('id', testCustomerId);
  }
  if (testStaffId) {
    await admin.from('staff').delete().eq('id', testStaffId);
  }
  if (testUserId) {
    await admin.auth.admin.deleteUser(testUserId);
  }
});

test('admin archives and restores a customer without losing the record', async ({ page }) => {
  if (!testCustomerId) throw new Error('Customer fixture was not created.');

  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-posta Adresi' }).fill(testEmail);
  await page.getByLabel('Şifre').fill(testPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page).toHaveURL('/dashboard');

  await page.goto('/customers');
  await expect(page.getByText(customerName, { exact: true }).first()).toBeVisible();
  await page.getByTestId(`customer-actions-${testCustomerId}`).first().click();
  await page.getByTestId(`archive-customer-${testCustomerId}`).click();
  await page.getByRole('button', { name: 'Evet, Arşivle' }).click();

  await expect(page.getByText(customerName, { exact: true })).toHaveCount(0);
  const { data: archived, error: archiveReadError } = await admin
    .from('customers')
    .select('is_deleted, deleted_at')
    .eq('id', testCustomerId)
    .single();
  if (archiveReadError) throw archiveReadError;
  expect(archived.is_deleted).toBe(true);
  expect(archived.deleted_at).not.toBeNull();

  await page.getByRole('link', { name: 'Arşiv' }).click();
  await expect(page).toHaveURL('/customers/archive');
  await expect(page.getByTestId(`archived-customer-${testCustomerId}`)).toContainText(customerName);
  await page.getByTestId(`restore-customer-${testCustomerId}`).click();
  await page.getByTestId('confirm-archive-action').click();
  await expect(page.getByTestId(`archived-customer-${testCustomerId}`)).toHaveCount(0);

  const { data: restored, error: restoreReadError } = await admin
    .from('customers')
    .select('is_deleted, deleted_at')
    .eq('id', testCustomerId)
    .single();
  if (restoreReadError) throw restoreReadError;
  expect(restored.is_deleted).toBe(false);
  expect(restored.deleted_at).toBeNull();

  await page.goto('/customers');
  await expect(page.getByText(customerName, { exact: true }).first()).toBeVisible();
});
