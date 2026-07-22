import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import type { Database } from '../src/types/database';

const testEmail = 'phase3-tasks@example.test';
const testPassword = process.env.E2E_STAFF_PASSWORD ?? 'E2E-only-Tasks!2026';
const taskTitle = 'Faz 3.3 tarayıcı görevi';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Authenticated E2E tests require local Supabase environment variables.');
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
});

let testUserId: string | null = null;
let testStaffId: string | null = null;

test.beforeAll(async () => {
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
      full_name: 'Faz 3.3 Görev Yöneticisi',
      email: testEmail,
      role: 'admin',
      is_active: true,
    })
    .select('id')
    .single();
  if (staffError) throw staffError;
  testStaffId = staff.id;
});

test.afterAll(async () => {
  if (testStaffId) await admin.from('tasks').delete().eq('assigned_staff_id', testStaffId);
  if (testStaffId) await admin.from('staff').delete().eq('id', testStaffId);
  if (testUserId) await admin.auth.admin.deleteUser(testUserId);
});

test('staff creates, receives and completes a personal task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'E-posta Adresi' }).fill(testEmail);
  await page.getByLabel('Şifre').fill(testPassword);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page).toHaveURL('/dashboard');

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Yeni Görev' }).click();
  await page.getByLabel('Başlık').fill(taskTitle);
  await page.getByLabel('Açıklama').fill('Görev ve kişisel bildirim uçtan uca kontrolü');

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 2);
  dueAt.setMinutes(0, 0, 0);
  const localDueAt = new Date(dueAt.getTime() - dueAt.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel('Tarih ve saat').fill(localDueAt);
  await page.getByLabel('Öncelik').selectOption('high');
  await page.getByTestId('create-task-submit').click();

  await page.getByRole('button', { name: 'Yaklaşan' }).click();
  const task = page.getByText(taskTitle, { exact: true });
  await expect(task).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Bildirimleri aç' }).click();
  await expect(page.getByText(`Yeni görev: ${taskTitle}`, { exact: true })).toBeVisible();
  await page.getByText(`Yeni görev: ${taskTitle}`, { exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\?task=/);

  await page.getByRole('button', { name: 'Yaklaşan' }).click();
  const taskRow = page.locator('article').filter({ hasText: taskTitle });
  await taskRow.getByRole('button', { name: 'Tamamla' }).click();
  await page.getByRole('button', { name: 'Tamamlanan' }).click();
  await expect(page.getByText(taskTitle, { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const { data: completed, error } = await admin
      .from('tasks')
      .select('status, completed_at, notifications(is_read, read_at)')
      .eq('title', taskTitle)
      .eq('assigned_staff_id', testStaffId!)
      .single();
    if (error) throw error;
    return {
      status: completed.status,
      hasCompletedAt: completed.completed_at !== null,
      notificationRead: completed.notifications[0]?.is_read ?? false,
      hasReadAt: completed.notifications[0]?.read_at != null,
    };
  }).toEqual({
    status: 'completed',
    hasCompletedAt: true,
    notificationRead: true,
    hasReadAt: true,
  });
});
