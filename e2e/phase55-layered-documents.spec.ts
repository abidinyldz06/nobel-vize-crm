import { expect, test } from "@playwright/test";
import {
  assertFixtureCleanup,
  assertNoSupabaseError,
  createStaffIdentity,
  e2eAdmin,
  loginFromBrowser,
  purgeStaffFixtures,
  type StaffIdentity,
} from "./support/supabase-fixtures";

const email = "phase55-layered-admin@example.test";
const password = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Phase55-Layers!2026";
const customerEmail = "phase55-layered-customer@example.test";
const countryName = "Faz 5.5 Katman E2E Ülkesi";

const documents = {
  base: "Faz 5.5 Genel Pasaport",
  employee: "Faz 5.5 Çalışan Belgesi",
  children: "Faz 5.5 Çocuk Muvafakatnamesi",
  nationality: "Faz 5.5 Oturum İzni",
};

let adminIdentity: StaffIdentity;
let countryId = "";

test.beforeAll(async () => {
  await e2eAdmin.from("customers").delete().eq("email", customerEmail);
  await e2eAdmin.from("countries").delete().eq("name", countryName);
  await purgeStaffFixtures([email]);

  adminIdentity = await createStaffIdentity({
    email,
    password,
    fullName: "Faz 5.5 Katman Yöneticisi",
    role: "admin",
  });

  const country = await e2eAdmin
    .from("countries")
    .insert({ name: countryName, active: true })
    .select("id")
    .single();
  assertNoSupabaseError("Faz 5.5 E2E ülkesi oluşturulamadı", country);
  countryId = country.data!.id;

  const rules = await e2eAdmin.from("country_visa_rules").insert([
    {
      country_id: countryId,
      visa_category: "turistik",
      documents: [{ name: documents.base, category: "temel", required: true }],
    },
    {
      country_id: countryId,
      visa_category: "turistik",
      occupation: "calisan",
      documents: [{ name: documents.employee, category: "mesleki", required: true }],
    },
    {
      country_id: countryId,
      visa_category: "turistik",
      with_children: true,
      documents: [{ name: documents.children, category: "aile", required: true }],
    },
    {
      country_id: countryId,
      visa_category: "turistik",
      nationality: "diger",
      documents: [{ name: documents.nationality, category: "kimlik", required: true }],
    },
  ]);
  assertNoSupabaseError("Faz 5.5 katman kuralları oluşturulamadı", rules);
});

test.afterAll(async () => {
  await e2eAdmin.from("customers").delete().eq("email", customerEmail);
  if (countryId) await e2eAdmin.from("countries").delete().eq("id", countryId);
  await purgeStaffFixtures([email]);
  await assertFixtureCleanup([email]);
});

test("general and profile overlays produce one document snapshot", async ({ page }) => {
  await loginFromBrowser(page, email, password);
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/customers/new");

  await page.locator('input[name="firstName"]').fill("Katmanlı");
  await page.locator('input[name="lastName"]').fill("Evrak Müşterisi");
  await page.locator('input[name="phone"]').fill("05550005555");
  await page.locator('input[name="email"]').fill(customerEmail);
  await page.locator('input[name="passportNo"]').fill("P5500055");
  await page.locator('input[name="passportExpiry"]').fill("2028-08-06");
  await page.locator('select[name="countryId"]').selectOption(countryId);
  await page.locator('select[name="visaType"]').selectOption("turistik");
  await page.locator('select[name="travelMethod"]').selectOption("ucak");
  await page.locator('select[name="accommodation"]').selectOption("otel");
  await page.locator('select[name="occupation"]').selectOption("calisan");
  await page.locator('select[name="withChildren"]').selectOption("true");
  await page.locator('select[name="nationality"]').selectOption("diger");
  await page.locator('select[name="assignedStaffId"]').selectOption(adminIdentity.staffId);

  await expect(page.getByText("4 Kural Birleştirildi")).toBeVisible();
  await expect(page.getByText("4 Evrak Bulundu")).toBeVisible();
  for (const documentName of Object.values(documents)) {
    await expect(page.getByText(documentName, { exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "Kaydet ve Dosya Aç" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = new URL(page.url()).pathname.split("/").at(-1)!;

  const customer = await e2eAdmin
    .from("customers")
    .select("applications(matched_rule_ids, documents(document_type))")
    .eq("id", customerId)
    .single();
  assertNoSupabaseError("Katmanlı evrak anlık görüntüsü okunamadı", customer);

  expect(customer.data!.applications).toHaveLength(1);
  expect(customer.data!.applications[0].matched_rule_ids).toHaveLength(4);
  expect(customer.data!.applications[0].documents.map(item => item.document_type).sort())
    .toEqual(Object.values(documents).sort());
});
