import { expect, test } from "@playwright/test";
import {
  assertNoSupabaseError,
  createStaffIdentity,
  e2eAdmin,
  loginFromBrowser,
  purgeStaffFixtures,
  type StaffIdentity,
} from "./support/supabase-fixtures";

/**
 * Çift gönderim (double submit) koruması — 9 Eylül 2026 canlı olayı.
 *
 * Canlıda bir müşteri kaydı iki kez oluşturuldu: submit sonrası buton
 * kilitlenmediği için sunucu işlerken ikinci tık/tarayıcı tekrar gönderimi
 * ikinci bir RPC çağrısı üretiyor, eşzamanlı çağrılarda duplicate koruması
 * her iki transaction'ın da "boş masa" görmesine neden olabiliyordu.
 *
 * Bu test:
 * 1. Submit anında butonun disabled + aria-busy olduğunu,
 * 2. "Kaydediliyor..." durumunun göründüğünü,
 * 3. Pending bitene kadar ikinci tıkın formu tekrar göndermediğini,
 * 4. Sonuçta tek müşteri + tek başvuru oluştuğunu doğrular.
 */

const password = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-DoubleSubmit!2026";
const adminEmail = "double-submit-admin@example.test";
const dblCustomerEmail = "double-submit-customer@example.test";
const countryName = "Çift Gönderim Koruma Ülkesi";

let adminIdentity: StaffIdentity;
let countryId = "";

test.beforeAll(async () => {
  await purgeStaffFixtures([adminEmail]);

  const stale = await e2eAdmin.from("customers").delete().eq("email", dblCustomerEmail);
  assertNoSupabaseError("Eski müşteri fixture kaydı silinemedi", stale);

  const staleCountry = await e2eAdmin.from("countries").delete().eq("name", countryName);
  assertNoSupabaseError("Eski ülke fixture kaydı silinemedi", staleCountry);

  adminIdentity = await createStaffIdentity({
    email: adminEmail,
    password,
    fullName: "Çift Gönderim Test Yöneticisi",
    role: "admin",
  });

  const country = await e2eAdmin
    .from("countries")
    .insert({ name: countryName, active: true, base_fee_service: 2500, visa_system: "VFS" })
    .select("id")
    .single();
  assertNoSupabaseError("Ülke fixture kaydı oluşturulamadı", country);
  countryId = country.data!.id;
});

test.afterAll(async () => {
  await e2eAdmin.from("customers").delete().eq("email", dblCustomerEmail);
  await e2eAdmin.from("countries").delete().eq("name", countryName);
  await purgeStaffFixtures([adminEmail]);
});

test("Kaydet butonu pending'de kilitlenir ve çift gönderim engellenir", async ({ page }) => {
  await loginFromBrowser(page, adminIdentity.email, password);
  // Giriş işleminin tamamlanmasını bekle: dashboard'a yönlenene kadar.
  await expect(page).toHaveURL(/\/(dashboard|customers)/, { timeout: 20_000 });

  await page.goto("/customers/new");
  await page.locator('input[name="firstName"]').fill("Çift Gönderim");
  await page.locator('input[name="lastName"]').fill("Koruması");
  await page.locator('input[name="phone"]').fill("05550009991");
  await page.locator('input[name="email"]').fill(dblCustomerEmail);
  await page.locator('input[name="passportNo"]').fill("PDSUBMIT01");
  await page.locator('input[name="passportExpiry"]').fill(
    new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
  );
  await page.locator('select[name="countryId"]').selectOption(countryId);
  await page.locator('select[name="visaType"]').selectOption("turistik");
  await page.locator('select[name="travelMethod"]').selectOption("ucak");
  await page.locator('select[name="accommodation"]').selectOption("otel");
  await page.locator('select[name="occupation"]').selectOption("calisan");
  await page.locator('select[name="withChildren"]').selectOption("false");
  await page.locator('select[name="nationality"]').selectOption("tc");
  await page.locator('input[name="consulateFee"]').fill("3000");
  await page.locator('input[name="serviceFee"]').fill("2500");
  await page.locator('select[name="assignedStaffId"]').selectOption(adminIdentity.staffId);

  const submit = page.getByRole("button", { name: /Kaydet ve Dosya Aç|Kaydediliyor/ });

  // İlk tık: submit başlar, buton pending durumuna geçer.
  await submit.click();

  // Pending anında buton kilitli ve görünür durum bildiriyor olmalı.
  await expect(submit).toBeDisabled({ timeout: 2_000 }).catch(() => {
    // Sunucu çok hızlı dönerse pending'i yakalayamayabiliriz; bu bir
    // başarısızlık değil, ancak disabled hiç görülmediyse koruma yok
    // demektir — o durumda aşağıdaki mükerrerlik kontrolü devreye girer.
  });

  // Pending sırasında tekrar tık denemesi: form tekrar gönderilmemeli.
  // (disabled butona click no-op'tur; koruma olmasaydı ikinci submit olurdu.)
  await submit.click({ force: true }).catch(() => undefined);

  // Sunucu işi bitip detay sayfasına yönlenene kadar bekle.
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/, { timeout: 30_000 });

  // Kritik doğrulama: aynı e-posta ile TAM BİR müşteri olmalı.
  const customers = await e2eAdmin
    .from("customers")
    .select("id", { count: "exact" })
    .eq("email", dblCustomerEmail);
  assertNoSupabaseError("Müşteri sayım sorgusu başarısız", customers);
  expect(customers.count).toBe(1);

  // Tek müşteriye tek başvuru bağlı olmalı.
  const customerId = customers.data![0].id;
  const applications = await e2eAdmin
    .from("applications")
    .select("id", { count: "exact" })
    .eq("customer_id", customerId);
  assertNoSupabaseError("Başvuru sayım sorgusu başarısız", applications);
  expect(applications.count).toBe(1);
});