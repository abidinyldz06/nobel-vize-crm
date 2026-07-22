import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import type { Database } from '../src/types/database';

const testEmail = 'phase34-board@example.test';
const testPassword = process.env.E2E_STAFF_PASSWORD ?? 'E2E-only-Application-Board!2026';
const customerEmail = 'phase34-board-customer@example.test';
const customerName = 'Faz 3.4 Pano Müşterisi';
const countryName = 'Faz 3.4 Test Ülkesi';
const passportExpiry = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isProductionSmoke = Boolean(process.env.PLAYWRIGHT_BASE_URL);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Authenticated E2E tests require local Supabase environment variables.');
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
});

let testUserId: string | null = null;
let testStaffId: string | null = null;
let testCustomerId: string | null = null;
let testApplicationId: string | null = null;
let testCountryId: string | null = null;

test.beforeAll(async () => {
  await admin.from('customers').delete().eq('email', customerEmail);
  await admin.from('staff').delete().eq('email', testEmail);

  const { data: users, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  for (const user of users.users.filter(candidate => candidate.email === testEmail)) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (authError) throw authError;
  testUserId = authData.user.id;

  const { data: staff, error: staffError } = await admin
    .from('staff')
    .insert({
      user_id: testUserId,
      full_name: 'Faz 3.4 Pano Yöneticisi',
      email: testEmail,
      role: 'admin',
      is_active: true,
    })
    .select('id')
    .single();
  if (staffError) throw staffError;
  testStaffId = staff.id;

  await admin.from('countries').delete().eq('name', countryName);
  const { data: country, error: countryError } = await admin
    .from('countries')
    .insert({ name: countryName, active: true })
    .select('id')
    .single();
  if (countryError) throw countryError;
  testCountryId = country.id;

  const { data: customer, error: customerError } = await admin
    .from('customers')
    .insert({
      first_name: 'Faz 3.4 Pano',
      last_name: 'Müşterisi',
      email: customerEmail,
      phone: '05550003401',
      passport_no: 'P3400001',
      passport_expiry: passportExpiry,
      assigned_staff_id: testStaffId,
    })
    .select('id')
    .single();
  if (customerError) throw customerError;
  testCustomerId = customer.id;

  const { data: application, error: applicationError } = await admin
    .from('applications')
    .insert({
      customer_id: testCustomerId,
      country: countryName,
      country_id: testCountryId,
      visa_type: 'turistik',
      status: 'profil_analizi',
      assigned_staff_id: testStaffId,
    })
    .select('id')
    .single();
  if (applicationError) throw applicationError;
  testApplicationId = application.id;

  const { error: paymentError } = await admin.from('payments').insert({
    application_id: testApplicationId,
    amount: 3456,
    status: 'alindi',
    currency: 'TRY',
  });
  if (paymentError) throw paymentError;
});

test.afterAll(async () => {
  if (testCustomerId) await admin.from('customers').delete().eq('id', testCustomerId);
  if (testCountryId) await admin.from('countries').delete().eq('id', testCountryId);
  if (testStaffId) await admin.from('staff').delete().eq('id', testStaffId);
  if (testUserId) await admin.auth.admin.deleteUser(testUserId);
});

test('staff moves an application through an allowed audited transition', async ({ page }) => {
  if (!testApplicationId) throw new Error('Application fixture was not created.');

  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-posta Adresi' }).fill(testEmail);
  await page.getByLabel('Şifre').fill(testPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page).toHaveURL('/dashboard');
  if (isProductionSmoke) {
    await expect(page.getByText('Bu Ay Başvuru').locator('..')).toBeVisible();
    await expect(page.getByText('Bu Ay Gelir').locator('..')).toBeVisible();
  } else {
    await expect(page.getByText('Bu Ay Başvuru').locator('..')).toContainText('1');
    await expect(page.getByText('Bu Ay Gelir').locator('..')).toContainText('₺3.456');
  }
  await expect(page.getByTestId('passport-warning-card')).toContainText(customerName);
  await expect(page.getByTestId('passport-warning-card')).toContainText('6 ay içinde bitiyor');

  await page.goto('/applications');
  const card = page.getByTestId(`application-card-${testApplicationId}`);
  await expect(card).toContainText(customerName);
  await card.getByRole('combobox', { name: `${customerName} sonraki aşama` }).selectOption('evrak_bekleniyor');

  await expect(page.getByTestId(`application-card-${testApplicationId}`)).toContainText(customerName);
  await expect.poll(async () => {
    const { data, error } = await admin
      .from('applications')
      .select('status')
      .eq('id', testApplicationId!)
      .single();
    if (error) throw error;
    return data.status;
  }).toBe('evrak_bekleniyor');

  const invalidResponse = await page.evaluate(async applicationId => {
    const response = await fetch('/api/applications/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, status: 'onaylandi' }),
    });
    return { status: response.status, body: await response.json() };
  }, testApplicationId);
  expect(invalidResponse.status).toBe(400);
  expect(invalidResponse.body.error).toContain('application_status_transition_not_allowed');

  const { data: application, error: applicationReadError } = await admin
    .from('applications')
    .select('status')
    .eq('id', testApplicationId)
    .single();
  if (applicationReadError) throw applicationReadError;
  expect(application.status).toBe('evrak_bekleniyor');

  const { data: logs, error: logError } = await admin
    .from('activity_log')
    .select('type, performed_by_staff_id')
    .eq('application_id', testApplicationId)
    .eq('type', 'status');
  if (logError) throw logError;
  expect(logs).toHaveLength(1);
  expect(logs[0].performed_by_staff_id).toBe(testStaffId);

  await page.goto(`/customers/${testCustomerId}/edit`);
  await page.getByLabel('Vize Türü').selectOption('is');
  await page.getByLabel('Seyahat Aracı').selectOption('ucak');
  await page.getByLabel('Konaklama').selectOption('otel');
  await page.getByLabel('Meslek').selectOption('calisan');
  await page.getByLabel('Çocuk Durumu').selectOption('false');
  await page.getByLabel('Uyruk').selectOption('tc');
  await page.getByLabel('VIP').check();
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();

  await expect(page).toHaveURL(`/customers/${testCustomerId}`);
  const applicationDetails = page.getByRole('heading', { name: 'Başvuru Bilgileri' }).locator('..').locator('..');
  await expect(applicationDetails).toContainText(countryName);
  await expect(applicationDetails).toContainText('İş');
  await expect(applicationDetails).toContainText('Uçak');
  await expect(applicationDetails).toContainText('Otel');
  await expect(applicationDetails).toContainText('Çalışan');
  await expect(applicationDetails).toContainText('Yok');
  await expect(applicationDetails).toContainText('TC Vatandaşı');

  const { data: edited, error: editedError } = await admin
    .from('applications')
    .select('country_id, visa_type, travel_method, accommodation, occupation, with_children, nationality')
    .eq('id', testApplicationId)
    .single();
  if (editedError) throw editedError;
  expect(edited).toEqual({
    country_id: testCountryId,
    visa_type: 'is',
    travel_method: 'ucak',
    accommodation: 'otel',
    occupation: 'calisan',
    with_children: false,
    nationality: 'tc',
  });

  await page.goto('/customers');
  await expect(page.getByTestId(`customer-tags-${testCustomerId}`)).toContainText('VIP');
  await page.getByLabel('Etikete göre filtrele').selectOption({ label: 'VIP' });
  await expect(page.getByText(customerName, { exact: true }).first()).toBeVisible();
  const quickActions = page.getByTestId(`quick-actions-${testCustomerId}`).first();
  await expect(quickActions.getByRole('link', { name: /telefon ara/ })).toHaveAttribute('href', 'tel:05550003401');
  await expect(quickActions.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/905550003401');
  await expect(quickActions.getByRole('link', { name: /e-posta/ })).toHaveAttribute('href', `mailto:${customerEmail}`);
  await quickActions.getByRole('button', { name: /hızlı not ekle/ }).click();
  await page.getByRole('textbox', { name: 'Hızlı not', exact: true }).fill('Faz 3.4 müşteri timeline notu');
  await page.getByRole('button', { name: 'Notu Kaydet' }).click();

  await page.goto(`/customers/${testCustomerId}`);
  await expect(page.getByTestId('customer-timeline')).toContainText('Faz 3.4 müşteri timeline notu');
  await expect(page.getByTestId('customer-timeline')).toContainText('Ödeme: ₺3.456');
});
