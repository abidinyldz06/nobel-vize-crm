import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import type { Page } from "@playwright/test";
import WebSocket from "ws";
import type { Database } from "../../src/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Authenticated E2E tests require local Supabase environment variables.");
}

const resolvedSupabaseUrl = supabaseUrl;
const resolvedAnonKey = anonKey;
const resolvedServiceRoleKey = serviceRoleKey;

function client(key: string) {
  return createClient<Database>(resolvedSupabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: {
      transport: WebSocket as unknown as WebSocketLikeConstructor,
    },
  });
}

export const e2eAdmin = client(resolvedServiceRoleKey);

export interface StaffIdentity {
  email: string;
  password: string;
  userId: string;
  staffId: string;
}

export function assertNoSupabaseError(
  label: string,
  result: { error: { message: string } | null },
) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
}

async function authUsersByEmail(email: string) {
  const matches = [];
  for (let page = 1; ; page += 1) {
    const result = await e2eAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    assertNoSupabaseError(`Auth kullanıcıları listelenemedi (${email})`, result);
    matches.push(...result.data.users.filter(user => user.email === email));
    if (result.data.users.length < 1000) break;
  }
  return matches;
}

export async function deleteAuthUsersByEmail(email: string) {
  for (const user of await authUsersByEmail(email)) {
    const result = await e2eAdmin.auth.admin.deleteUser(user.id);
    assertNoSupabaseError(`Auth kullanıcısı silinemedi (${email})`, result);
  }
}

export async function purgeStaffFixtures(emails: string[]) {
  const staffResult = await e2eAdmin
    .from("staff")
    .select("id")
    .in("email", emails);
  assertNoSupabaseError("Personel fixture kayıtları okunamadı", staffResult);
  const staffIds = (staffResult.data ?? []).map(staff => staff.id);

  if (staffIds.length > 0) {
    for (const [label, promise] of [
      ["Fixture müşterileri silinemedi", e2eAdmin.from("customers").delete().in("assigned_staff_id", staffIds)],
      ["Fixture bildirimleri silinemedi", e2eAdmin.from("notifications").delete().in("recipient_staff_id", staffIds)],
      ["Fixture görevleri silinemedi", e2eAdmin.from("tasks").delete().in("assigned_staff_id", staffIds)],
      ["Fixture personelleri silinemedi", e2eAdmin.from("staff").delete().in("id", staffIds)],
    ] as const) {
      assertNoSupabaseError(label, await promise);
    }
  }

  for (const email of emails) {
    await deleteAuthUsersByEmail(email);
  }
}

export async function createStaffIdentity(input: {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "consultant";
  isActive?: boolean;
}): Promise<StaffIdentity> {
  const authResult = await e2eAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  assertNoSupabaseError(`Auth fixture oluşturulamadı (${input.email})`, authResult);
  const authUser = authResult.data.user;
  if (!authUser) throw new Error(`Auth fixture kullanıcı kimliği üretmedi (${input.email}).`);

  const staffResult = await e2eAdmin
    .from("staff")
    .insert({
      user_id: authUser.id,
      full_name: input.fullName,
      email: input.email,
      role: input.role,
      is_active: input.isActive ?? true,
    })
    .select("id")
    .single();
  assertNoSupabaseError(`Personel fixture oluşturulamadı (${input.email})`, staffResult);

  return {
    email: input.email,
    password: input.password,
    userId: authUser.id,
    staffId: staffResult.data!.id,
  };
}

export async function createUnlinkedAuthIdentity(email: string, password: string) {
  const result = await e2eAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assertNoSupabaseError(`Bağlantısız Auth fixture oluşturulamadı (${email})`, result);
  if (!result.data.user) throw new Error(`Bağlantısız Auth fixture kullanıcı kimliği üretmedi (${email}).`);
  return result.data.user.id;
}

export async function createAuthenticatedClient(email: string, password: string) {
  const authenticatedClient = client(resolvedAnonKey) as SupabaseClient<Database>;
  const result = await authenticatedClient.auth.signInWithPassword({ email, password });
  assertNoSupabaseError(`E2E Supabase oturumu açılamadı (${email})`, result);
  return authenticatedClient;
}

export async function loginFromBrowser(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "E-posta Adresi" }).fill(email);
  await page.getByLabel("Şifre").fill(password);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
}

export async function assertFixtureCleanup(emails: string[]) {
  const staffResult = await e2eAdmin
    .from("staff")
    .select("id", { count: "exact", head: true })
    .in("email", emails);
  assertNoSupabaseError("Personel fixture temizliği doğrulanamadı", staffResult);
  if (staffResult.count !== 0) {
    throw new Error(`Personel fixture temizliği eksik: ${staffResult.count} kayıt kaldı.`);
  }

  for (const email of emails) {
    if ((await authUsersByEmail(email)).length !== 0) {
      throw new Error(`Auth fixture temizliği eksik: ${email}`);
    }
  }
}
