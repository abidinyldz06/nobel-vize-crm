import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import type { Database } from '../src/types/database';

const testEmail = 'phase35-admin@example.test';
const testPassword = process.env.E2E_STAFF_PASSWORD ?? 'E2E-only-Phase35!2026';
const customerEmail = 'phase35-customer@example.test';
const customerName = 'Faz 3.5 Portal Müşterisi';
const countryName = 'Faz 3.5 Test Ülkesi';
const customTemplateName = 'Faz 3.5 Özel Şablon';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Authenticated E2E tests require local Supabase environment variables.');
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
});

let userId: string | null = null;
let staffId: string | null = null;
let customerId: string | null = null;
let applicationId: string | null = null;
let countryId: string | null = null;
let portalToken: string | null = null;

test.beforeAll(async () => {
  await admin.from('message_templates').delete().eq('name', customTemplateName);
  await admin.from('customers').delete().eq('email', customerEmail);
  await admin.from('staff').delete().eq('email', testEmail);
  const listed = await admin.auth.admin.listUsers();
  if (listed.error) throw listed.error;
  for (const user of listed.data.users.filter(candidate => candidate.email === testEmail)) {
    await admin.auth.admin.deleteUser(user.id);
  }

  const created = await admin.auth.admin.createUser({ email: testEmail, password: testPassword, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const staff = await admin.from('staff').insert({
    user_id: userId,
    full_name: 'Faz 3.5 Yöneticisi',
    email: testEmail,
    role: 'admin',
    is_active: true,
  }).select('id').single();
  if (staff.error) throw staff.error;
  staffId = staff.data.id;

  await admin.from('countries').delete().eq('name', countryName);
  const country = await admin.from('countries').insert({ name: countryName, active: true }).select('id').single();
  if (country.error) throw country.error;
  countryId = country.data.id;

  const customer = await admin.from('customers').insert({
    first_name: 'Faz 3.5 Portal',
    last_name: 'Müşterisi',
    email: customerEmail,
    phone: '05550003501',
    assigned_staff_id: staffId,
  }).select('id, portal_token').single();
  if (customer.error) throw customer.error;
  customerId = customer.data.id;
  portalToken = customer.data.portal_token;

  const oldApplication = await admin.from('applications').insert({
    customer_id: customerId,
    country: 'Eski Başvuru Ülkesi',
    visa_type: 'turistik',
    status: 'kapandi',
    assigned_staff_id: staffId,
    created_at: '2025-01-01T10:00:00.000Z',
  }).select('id').single();
  if (oldApplication.error) throw oldApplication.error;

  const application = await admin.from('applications').insert({
    customer_id: customerId,
    country: countryName,
    country_id: countryId,
    visa_type: 'turistik',
    status: 'randevu_alindi',
    appointment_date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    appointment_location: 'Faz 3.5 Konsolosluk Merkezi',
    total_fee: 5000,
    assigned_staff_id: staffId,
  }).select('id').single();
  if (application.error) throw application.error;
  applicationId = application.data.id;

  const document = await admin.from('documents').insert({
    application_id: applicationId,
    document_type: 'Faz 3.5 Pasaport Fotokopisi',
    status: 'bekleniyor',
    is_required: true,
  });
  if (document.error) throw document.error;
  const payment = await admin.from('payments').insert({
    application_id: applicationId,
    amount: 1500,
    status: 'alindi',
    currency: 'TRY',
  });
  if (payment.error) throw payment.error;
});

test.afterAll(async () => {
  await admin.from('message_templates').delete().eq('name', customTemplateName);
  if (customerId) await admin.from('customers').delete().eq('id', customerId);
  if (countryId) await admin.from('countries').delete().eq('id', countryId);
  if (staffId) await admin.from('staff').delete().eq('id', staffId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test('admin manages templates, records communication delivery and controls the improved portal', async ({ page }) => {
  test.setTimeout(90_000);
  if (!customerId || !applicationId || !portalToken) throw new Error('Phase 3.5 fixture was not created.');
  const currentCustomerId = customerId;

  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-posta Adresi' }).fill(testEmail);
  await page.getByLabel('Şifre').fill(testPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page).toHaveURL('/dashboard');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Mesaj Şablonları' }).click();
  await expect(page.getByTestId('message-template-editor')).toBeVisible();
  await page.getByLabel('Şablon Adı').fill(customTemplateName);
  await page.getByLabel('Kanal').selectOption('email');
  await page.getByLabel('E-posta Konusu').fill('{{country}} özel bilgilendirme');
  await page.getByLabel('Mesaj').fill('Merhaba {{first_name}}, durumunuz: {{status}}');
  await page.getByTestId('message-template-editor').getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText(customTemplateName, { exact: true }).first()).toBeVisible();

  await page.goto(`/customers/${customerId}`);
  await page.getByRole('button', { name: 'Mesaj Hazırla' }).click();
  const composer = page.getByTestId('message-composer');
  await composer.getByLabel('Şablon').selectOption({ label: 'WhatsApp — Portal Bağlantısı' });
  await expect(composer).toContainText('Merhaba Faz 3.5 Portal');
  await expect(composer).toContainText(`/portal/${portalToken}`);
  const popupPromise = page.waitForEvent('popup');
  await composer.getByRole('button', { name: 'Kaydet ve Uygulamada Aç' }).click();
  const popup = await popupPromise;
  await popup.close();

  await expect.poll(async () => {
    const result = await admin.from('communications').select('status').eq('customer_id', currentCustomerId).eq('type', 'whatsapp').order('created_at', { ascending: false }).limit(1).single();
    if (result.error) throw result.error;
    return result.data.status;
  }).toBe('hazirlandi');

  const preparedCommunication = await admin.from('communications').select('id').eq('customer_id', currentCustomerId).eq('type', 'whatsapp').order('created_at', { ascending: false }).limit(1).single();
  if (preparedCommunication.error) throw preparedCommunication.error;

  await page.reload();
  const communication = page.getByTestId(`communication-${preparedCommunication.data.id}`);
  page.once('dialog', dialog => dialog.accept('WhatsApp penceresi müşteri tarafından kapatıldı'));
  await communication.getByRole('button', { name: 'Başarısız' }).click();
  await expect(communication).toContainText('basarisiz');
  await expect(communication).toContainText('WhatsApp penceresi müşteri tarafından kapatıldı');

  await page.goto(`/portal/${portalToken}`);
  await expect(page.getByText(customerName)).toBeVisible();
  await expect(page.getByText('Faz 3.5 Pasaport Fotokopisi')).toBeVisible();
  await expect(page.getByText('Faz 3.5 Konsolosluk Merkezi')).toBeVisible();
  await expect(page.getByTestId('portal-application-history')).toContainText('Eski Başvuru Ülkesi');
  await expect(page.getByText('₺3.500')).toBeVisible();

  await page.goto(`/customers/${customerId}`);
  await page.getByRole('button', { name: 'Portal Linki' }).click();
  await page.getByRole('button', { name: 'Portal Erişimini Kapat' }).click();
  await expect(page.getByText('Bu müşterinin portal erişimi kapalı.')).toBeVisible();

  await page.goto(`/portal/${portalToken}`);
  await expect(page.getByRole('heading', { name: 'Geçersiz Bağlantı' })).toBeVisible();
});
