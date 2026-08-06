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

const email = "phase54-country-rule@example.test";
const password = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Phase54-Catalog!2026";
const countryName = "Faz 5.4 E2E Ülkesi";

let adminIdentity: StaffIdentity;
let countryId = "";

test.beforeAll(async () => {
  await purgeStaffFixtures([email]);
  await e2eAdmin.from("countries").delete().eq("name", countryName);

  adminIdentity = await createStaffIdentity({
    email,
    password,
    fullName: "Faz 5.4 E2E Yönetici",
    role: "admin",
  });

  const country = await e2eAdmin
    .from("countries")
    .insert({ name: countryName, active: true })
    .select("id")
    .single();
  assertNoSupabaseError("Faz 5.4 ülkesi oluşturulamadı", country);
  countryId = country.data!.id;

  const rule = await e2eAdmin.from("country_visa_rules").insert({
    country_id: countryId,
    visa_category: "turistik",
    documents: [{ name: "Pasaport", category: "temel", required: true }],
    sources: [],
  });
  assertNoSupabaseError("Faz 5.4 kuralı oluşturulamadı", rule);
});

test.afterAll(async () => {
  await e2eAdmin
    .from("activity_log")
    .delete()
    .like("action", `%${countryName}%`);
  if (countryId) await e2eAdmin.from("countries").delete().eq("id", countryId);
  await purgeStaffFixtures([email]);
  await assertFixtureCleanup([email]);
});

test("admin adds and confirms an official source from the catalog UI", async ({ page }) => {
  await loginFromBrowser(page, email, password);
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/countries");
  await page.getByRole("button", { name: new RegExp(countryName) }).click();
  await page.getByRole("button", { name: "Evrak Kuralları" }).click();

  const ruleRow = page.getByRole("row").filter({ hasText: "Turistik" });
  await expect(ruleRow).toContainText("Kaynak eklenmemiş");
  await ruleRow.getByRole("button", { name: "Kuralı düzenle" }).click();

  await page.getByRole("button", { name: "Kaynak Ekle" }).click();
  await page.getByLabel("Kaynak Başlığı").fill("Faz 5.4 Resmî E2E Kaynağı");
  await page.getByLabel("HTTPS Adresi").fill("https://example.test/phase54-official");
  await page.getByLabel("Kaynakları şimdi kontrol ettim.").check();

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("Resmî kaynak doğrulandı")).toBeVisible();

  const savedRule = await e2eAdmin
    .from("country_visa_rules")
    .select("sources, sources_reviewed_by_staff_id")
    .eq("country_id", countryId)
    .single();
  assertNoSupabaseError("Faz 5.4 kaynak doğrulaması okunamadı", savedRule);
  expect(savedRule.data!.sources).toEqual(expect.arrayContaining([
    expect.objectContaining({
      title: "Faz 5.4 Resmî E2E Kaynağı",
      url: "https://example.test/phase54-official",
      kind: "official",
      checked_at: expect.any(String),
    }),
  ]));
  expect(savedRule.data!.sources_reviewed_by_staff_id).toBe(adminIdentity.staffId);
});
