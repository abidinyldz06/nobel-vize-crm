import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import type { Database } from '../src/types/database';

const testEmail = 'phase36-admin@example.test';
const testPassword = process.env.E2E_STAFF_PASSWORD ?? 'E2E-only-Phase36!2026';
const customerEmail = 'phase36-customer@example.test';
const noticeVersion = `E2E-${Date.now()}`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) throw new Error('Authenticated E2E tests require Supabase environment variables.');

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
});

let userId: string | null = null;
let staffId: string | null = null;
let customerId: string | null = null;

test.beforeAll(async () => {
  await admin.from('customers').delete().eq('email', customerEmail);
  await admin.from('privacy_notice_versions').delete().eq('version', noticeVersion);
  await admin.from('staff').delete().eq('email', testEmail);
  const users = await admin.auth.admin.listUsers();
  if (users.error) throw users.error;
  for (const user of users.data.users.filter(candidate => candidate.email === testEmail)) await admin.auth.admin.deleteUser(user.id);

  const created = await admin.auth.admin.createUser({ email: testEmail, password: testPassword, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const staff = await admin.from('staff').insert({ user_id: userId, full_name: 'Faz 3.6 Yöneticisi', email: testEmail, role: 'admin', is_active: true }).select('id').single();
  if (staff.error) throw staff.error;
  staffId = staff.data.id;
  const customer = await admin.from('customers').insert({ first_name: 'KVKK', last_name: 'Müşterisi', email: customerEmail, phone: '05550003601', assigned_staff_id: staffId }).select('id').single();
  if (customer.error) throw customer.error;
  customerId = customer.data.id;
});

test.afterAll(async () => {
  if (customerId) await admin.from('customers').delete().eq('id', customerId);
  await admin.from('privacy_notice_versions').delete().eq('version', noticeVersion);
  if (staffId) await admin.from('staff').delete().eq('id', staffId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test('admin versions privacy notices and records separate delivery and consent history', async ({ page }) => {
  test.setTimeout(90_000);
  if (!customerId) throw new Error('Phase 3.6 fixture was not created.');
  const fixtureCustomerId = customerId;

  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-posta Adresi' }).fill(testEmail);
  await page.getByLabel('Şifre').fill(testPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page).toHaveURL('/dashboard');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'KVKK Metinleri' }).click();
  await expect(page.getByTestId('privacy-notice-settings')).toBeVisible();
  await page.getByLabel('Aydınlatma Sürümü').fill(noticeVersion);
  await page.getByLabel('Aydınlatma Başlığı').fill('Faz 3.6 Test Aydınlatması');
  await page.getByLabel('Aydınlatma Metni').fill('Müşteri verilerinin işlenmesine ilişkin sürümlü test aydınlatma metni.');
  await page.getByLabel('Aydınlatma Aktif').check();
  await page.getByTestId('privacy-notice-settings').getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByText('Aydınlatma metni sürümü kaydedildi.')).toBeVisible();
  await expect(page.getByText(`${noticeVersion} · Faz 3.6 Test Aydınlatması`)).toBeVisible();

  await page.goto(`/customers/${customerId}`);
  const panel = page.getByTestId('customer-privacy-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('KVKK Kanıt Notu').fill('Müşteriye e-posta ile gönderildi ve teyit alındı.');
  await panel.getByRole('button', { name: 'Aydınlatma teslimini kaydet' }).click();
  await expect(panel.getByText('Aydınlatma teslim kaydı oluşturuldu.')).toBeVisible();

  await panel.getByLabel('KVKK Kanıt Notu').fill('Pazarlama rızası e-posta yanıtıyla alındı.');
  await panel.getByRole('button', { name: 'Rıza kararını kaydet' }).click();
  await expect(panel.getByText('Rıza kararı geçmişe eklendi.')).toBeVisible();

  await panel.getByLabel('Rıza Kararı').selectOption('withdrawn');
  await panel.getByLabel('Rıza Kaynağı').selectOption('telefon');
  await panel.getByRole('button', { name: 'Rıza kararını kaydet' }).click();
  await expect(panel.getByText('Rızayı geri çekti', { exact: true }).last()).toBeVisible();

  const deliveries = await admin.from('customer_privacy_notices').select('id').eq('customer_id', customerId);
  if (deliveries.error) throw deliveries.error;
  expect(deliveries.data).toHaveLength(1);
  const decisions = await admin.from('customer_consents').select('decision').eq('customer_id', customerId).eq('consent_type', 'marketing');
  if (decisions.error) throw decisions.error;
  expect(decisions.data.map(item => item.decision).sort()).toEqual(['granted', 'withdrawn']);

  await panel.getByLabel('KVKK Talep Türü').selectOption('anonymization');
  await panel.getByLabel('KVKK Talep Kanalı').selectOption('email');
  await panel.getByLabel('KVKK Talep Notu').fill('Kimlik kontrolü tamamlandı; anonimleştirme talebi alındı.');
  await panel.getByRole('button', { name: 'Talebi kaydet' }).click();
  await expect(panel.getByText('Veri sahibi talebi kaydedildi.')).toBeVisible();
  await panel.getByRole('button', { name: 'Onayla' }).click();
  await expect(panel.getByText('Talep durumu güncellendi.')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await panel.getByRole('link', { name: 'Müşteri veri paketini indir' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kvkk-/);

  const archivedAt = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const archive = await admin.from('customers').update({ is_deleted: true, deleted_at: archivedAt }).eq('id', customerId);
  if (archive.error) throw archive.error;
  await page.goto('/customers/archive');
  await page.getByTestId(`anonymize-customer-${customerId}`).click();
  await expect.poll(async () => {
    const result = await admin.from('customers').select('anonymized_at, email, phone').eq('id', fixtureCustomerId).single();
    if (result.error) throw result.error;
    return Boolean(result.data.anonymized_at) && result.data.email === null && result.data.phone === null;
  }).toBe(true);
});
