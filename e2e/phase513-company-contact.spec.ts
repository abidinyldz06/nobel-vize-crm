import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { expect, test } from "@playwright/test";
import WebSocket from "ws";
import type { Database } from "../src/types/database";

const testEmail = "phase513-company-contact@example.test";
const testPassword = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Company-Contact!2026";
const verifiedCompanyEmail = "phase513-verified@example.test";
const verifiedCompanyPhone = "0544 328 40 75";
const officialContactUrl = "https://www.nobelvize.com/iletisim/";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Authenticated E2E tests require local Supabase environment variables.");
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
let originalCompany: Pick<
  Database["public"]["Tables"]["tenants"]["Row"],
  | "company_name"
  | "email"
  | "phone"
  | "contact_source_url"
  | "contact_verified_at"
  | "contact_verified_by_staff_id"
> | null = null;

test.beforeAll(async () => {
  const { data: company, error: companyError } = await admin
    .from("tenants")
    .select("company_name, email, phone, contact_source_url, contact_verified_at, contact_verified_by_staff_id")
    .single();
  if (companyError || !company) throw companyError ?? new Error("Company settings were not found.");
  originalCompany = company;

  await admin.from("staff").delete().eq("email", testEmail);

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
  const { error: staffError } = await admin.from("staff").insert({
    user_id: testUserId,
    full_name: "Faz 5.1.3 E2E Yönetici",
    email: testEmail,
    role: "admin",
    is_active: true,
  });
  if (staffError) throw staffError;
});

test.afterAll(async () => {
  if (originalCompany) {
    const { error } = await admin.from("tenants").update(originalCompany).eq("company_name", originalCompany.company_name);
    if (error) throw error;
  }

  await admin
    .from("activity_log")
    .delete()
    .eq("action", "Şirket iletişim bilgileri resmî kaynaktan doğrulandı — Faz 5.1.3 E2E Yönetici");

  if (!testUserId) return;
  await admin.from("staff").delete().eq("user_id", testUserId);
  await admin.auth.admin.deleteUser(testUserId);
});

test("admin verifies company contact from the official source", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "E-posta Adresi" }).fill(testEmail);
  await page.getByLabel("Şifre").fill(testPassword);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/settings");
  await page.getByLabel("E-posta").fill(verifiedCompanyEmail);
  await page.getByLabel("Telefon").fill(verifiedCompanyPhone);
  await page.getByRole("button", { name: "Doğrula ve Kaydet" }).click();

  await expect(page.getByText("Değişiklikler başarıyla kaydedildi!")).toBeVisible();
  const verification = page.getByTestId("company-contact-verification");
  await expect(verification).toContainText("Resmî kaynakla doğrulandı");
  await expect(verification.getByRole("link", { name: "Kaynağı aç" })).toHaveAttribute("href", officialContactUrl);
  await expect(page.getByLabel("E-posta")).toHaveValue(verifiedCompanyEmail);
  await expect(page.getByLabel("Telefon")).toHaveValue(verifiedCompanyPhone);
});
