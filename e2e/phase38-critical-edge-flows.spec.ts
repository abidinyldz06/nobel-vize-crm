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

const password = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Phase38-Critical!2026";
const emails = {
  admin: "phase38-critical-admin@example.test",
  emptyConsultant: "phase38-empty-consultant@example.test",
};
const allEmails = Object.values(emails);
const countryName = "Faz 3.8 Kabul Ülkesi";
const uiCustomerEmail = "phase38-critical-customer@example.test";
const edgeCustomerEmail = "phase38-edge-customer@example.test";
const fixtureCustomerEmails = [uiCustomerEmail, edgeCustomerEmail];
const documentNames = ["Faz 3.8 Pasaport", "Faz 3.8 Gelir Belgesi"];

let adminIdentity: StaffIdentity;
let emptyConsultant: StaffIdentity;
let countryId = "";
let ruleId = "";

test.beforeAll(async () => {
  await purgeStaffFixtures(allEmails);

  const staleCountry = await e2eAdmin.from("countries").delete().eq("name", countryName);
  assertNoSupabaseError("Eski ülke fixture kaydı silinemedi", staleCountry);

  adminIdentity = await createStaffIdentity({
    email: emails.admin,
    password,
    fullName: "Faz 3.8 Kritik Akış Yöneticisi",
    role: "admin",
  });
  emptyConsultant = await createStaffIdentity({
    email: emails.emptyConsultant,
    password,
    fullName: "Faz 3.8 Boş Danışman",
    role: "consultant",
  });

  const country = await e2eAdmin
    .from("countries")
    .insert({
      name: countryName,
      active: true,
      base_fee_service: 2500,
      visa_system: "VFS",
    })
    .select("id")
    .single();
  assertNoSupabaseError("Kritik akış ülke fixture kaydı oluşturulamadı", country);
  countryId = country.data!.id;

  const rule = await e2eAdmin
    .from("country_visa_rules")
    .insert({
      country_id: countryId,
      visa_category: "turistik",
      documents: [
        {
          name: documentNames[0],
          category: "temel",
          required: true,
          description: "Kimlik ve seyahat geçerlilik kontrolü",
        },
        {
          name: documentNames[1],
          category: "finansal",
          required: true,
          description: "Başvuru finansal yeterlilik kontrolü",
        },
      ],
    })
    .select("id")
    .single();
  assertNoSupabaseError("Kritik akış evrak kuralı oluşturulamadı", rule);
  ruleId = rule.data!.id;
});

test.afterAll(async () => {
  await purgeStaffFixtures(allEmails);
  await purgeStaffFixtures(allEmails);

  if (countryId) {
    const countryDelete = await e2eAdmin.from("countries").delete().eq("id", countryId);
    assertNoSupabaseError("Kritik akış ülke fixture kaydı temizlenemedi", countryDelete);
  }

  const customers = await e2eAdmin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .in("email", fixtureCustomerEmails);
  assertNoSupabaseError("Kritik akış müşteri temizliği doğrulanamadı", customers);
  expect(customers.count).toBe(0);

  const countries = await e2eAdmin
    .from("countries")
    .select("id", { count: "exact", head: true })
    .eq("name", countryName);
  assertNoSupabaseError("Kritik akış ülke temizliği doğrulanamadı", countries);
  expect(countries.count).toBe(0);

  await assertFixtureCleanup(allEmails);
});

test("3.8.4 verisi olmayan danışman ekranları güvenli boş durum gösterir", async ({ page }) => {
  await loginFromBrowser(page, emptyConsultant.email, password);
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("Size atanmış başvuru yok.")).toBeVisible();

  await page.goto("/customers");
  await expect(page.getByText("Henüz hiç müşteri yok.").first()).toBeVisible();

  await page.goto("/applications");
  await expect(page.getByText("Bu aşamada başvuru yok.").first()).toBeVisible();

  await page.goto("/tasks");
  await expect(page.getByText("Bu bölümde görev yok.")).toBeVisible();
});

test("3.8.3 müşteri oluşturma, randevu, evrak ve ödeme zinciri uçtan uca çalışır", async ({ page }) => {
  test.setTimeout(90_000);
  await loginFromBrowser(page, adminIdentity.email, password);
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/customers/new");

  await page.locator('input[name="firstName"]').fill("Kritik Akış");
  await page.locator('input[name="lastName"]').fill("Müşterisi");
  await page.locator('input[name="phone"]').fill("123");
  await page.locator('input[name="email"]').fill(uiCustomerEmail);
  await page.locator('input[name="passportNo"]').fill("P3800001");
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
  await page.locator('textarea[name="consultantNote"]').fill("Faz 3.8 kritik akış danışman notu");

  await expect(page.getByText(documentNames[0], { exact: true })).toBeVisible();
  await expect(page.getByText(documentNames[1], { exact: true })).toBeVisible();
  await expect(page.locator('input[name="matchedRuleId"]')).toHaveValue(ruleId);

  await page.getByRole("button", { name: "Kaydet ve Dosya Aç" }).click();
  await expect(page).toHaveURL("/customers/new");
  await expect(page.locator('input[name="phone"]')).toHaveJSProperty("validity.patternMismatch", true);

  const invalidCustomer = await e2eAdmin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("email", uiCustomerEmail);
  assertNoSupabaseError("Geçersiz form sonrası müşteri kontrolü başarısız", invalidCustomer);
  expect(invalidCustomer.count).toBe(0);

  await page.locator('input[name="phone"]').fill("05550003850");
  await page.getByRole("button", { name: "Kaydet ve Dosya Aç" }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  const customerId = new URL(page.url()).pathname.split("/").at(-1)!;

  const customer = await e2eAdmin
    .from("customers")
    .select("id, assigned_staff_id, applications(id, status, total_fee, country_id, documents(id, document_type), notes(content))")
    .eq("id", customerId)
    .single();
  assertNoSupabaseError("Oluşturulan kritik müşteri zinciri okunamadı", customer);
  expect(customer.data!.assigned_staff_id).toBe(adminIdentity.staffId);
  expect(customer.data!.applications).toHaveLength(1);
  const applicationId = customer.data!.applications[0].id;
  expect(customer.data!.applications[0]).toMatchObject({
    status: "profil_analizi",
    total_fee: 5500,
    country_id: countryId,
  });
  expect(customer.data!.applications[0].documents.map(item => item.document_type).sort()).toEqual(
    [...documentNames].sort(),
  );
  const documentId = customer.data!.applications[0].documents.find(
    item => item.document_type === documentNames[0],
  )!.id;
  expect(customer.data!.applications[0].notes.map(item => item.content)).toContain(
    "Faz 3.8 kritik akış danışman notu",
  );

  const activity = await e2eAdmin
    .from("activity_log")
    .select("id, performed_by_staff_id")
    .eq("customer_id", customerId);
  assertNoSupabaseError("Müşteri oluşturma audit kayıtları okunamadı", activity);
  expect(activity.data!.length).toBeGreaterThanOrEqual(2);
  expect(activity.data!.every(item => item.performed_by_staff_id === adminIdentity.staffId)).toBe(true);

  const appointmentDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/customers/${customerId}/appointment`);
  await page.getByText("iDATA", { exact: true }).click();
  await expect(page.locator('input[name="appointmentSystem"][value="iDATA"]')).toBeChecked();
  await page.locator('input[name="date"]').fill(appointmentDate);
  await page.locator('input[name="time"]').fill("10:30");
  await page.locator('input[name="location"]').fill("Faz 3.8 Ankara Kabul Merkezi");
  await page.locator('textarea[name="appointmentNote"]').fill("Kritik akış randevu notu");
  await page.getByRole("button", { name: "Yine de Kaydet" }).click();
  await expect(page).toHaveURL(`/customers/${customerId}`);

  const appointment = await e2eAdmin
    .from("applications")
    .select("status, appointment_date, appointment_location")
    .eq("id", applicationId)
    .single();
  assertNoSupabaseError("Randevu kaydı okunamadı", appointment);
  expect(appointment.data).toMatchObject({
    status: "randevu_alindi",
    appointment_location: "Faz 3.8 Ankara Kabul Merkezi",
  });
  expect(appointment.data!.appointment_date).not.toBeNull();

  const document = page.getByTestId(`document-${documentId}`);
  await expect(document).toContainText(documentNames[0]);
  await document.click();
  await expect(document).toContainText("Tamamlandı");
  await expect.poll(async () => {
    const result = await e2eAdmin.from("documents").select("status").eq("id", documentId).single();
    assertNoSupabaseError("Evrak durumu okunamadı", result);
    return result.data!.status;
  }).toBe("onaylandi");

  const payments = page.getByTestId("payments-panel");
  await payments.getByRole("button", { name: "Ödeme Ekle" }).click();
  await payments.getByLabel("Ödeme tutarı").fill("0");
  await payments.getByRole("button", { name: "Ödemeyi Kaydet" }).click();
  await expect(payments.getByText("Lütfen geçerli bir tutar girin.")).toBeVisible();

  const paymentBefore = await e2eAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId);
  assertNoSupabaseError("Geçersiz ödeme sonrası kayıt kontrolü başarısız", paymentBefore);
  expect(paymentBefore.count).toBe(0);

  await payments.getByLabel("Ödeme tutarı").fill("2000");
  await payments.getByLabel("Ödeme türü").selectOption("upfront");
  await payments.getByLabel("Ödeme yöntemi").selectOption("havale");
  await payments.getByLabel("Ödeme notu").fill("Faz 3.8 kabul ödemesi");
  await payments.getByRole("button", { name: "Ödemeyi Kaydet" }).click();
  await expect(payments).toContainText("₺2.000");
  await expect(payments).toContainText("Faz 3.8 kabul ödemesi");

  const payment = await e2eAdmin
    .from("payments")
    .select("amount, type, method, status")
    .eq("application_id", applicationId)
    .single();
  assertNoSupabaseError("Kritik akış ödemesi okunamadı", payment);
  expect(payment.data).toEqual({
    amount: 2000,
    type: "upfront",
    method: "havale",
    status: "alindi",
  });

  await page.reload();
  const timeline = page.getByTestId("customer-timeline");
  await expect(timeline).toContainText("Randevu eklendi");
  await expect(timeline).toContainText("Evrak güncellendi");
  await expect(timeline).toContainText("Ödeme: ₺2.000");
});

test("3.8.4 bozuk istekler veri değiştirmez, eşzamanlı geçiş tek audit üretir ve retry idempotenttir", async ({ page }) => {
  const customer = await e2eAdmin
    .from("customers")
    .insert({
      first_name: "Kenar Durum",
      last_name: "Müşterisi",
      email: edgeCustomerEmail,
      phone: "05550003851",
      assigned_staff_id: adminIdentity.staffId,
    })
    .select("id")
    .single();
  assertNoSupabaseError("Kenar durum müşteri fixture kaydı oluşturulamadı", customer);
  const customerId = customer.data!.id;

  const application = await e2eAdmin
    .from("applications")
    .insert({
      customer_id: customerId,
      assigned_staff_id: adminIdentity.staffId,
      country: countryName,
      country_id: countryId,
      visa_type: "turistik",
      status: "randevu_alindi",
      total_fee: 5500,
      appointment_date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      appointment_location: "Faz 3.8 Kenar Durum Merkezi",
    })
    .select("id")
    .single();
  assertNoSupabaseError("Kenar durum başvuru fixture kaydı oluşturulamadı", application);
  const applicationId = application.data!.id;

  await loginFromBrowser(page, adminIdentity.email, password);
  await expect(page).toHaveURL("/dashboard");

  const malformed = await page.evaluate(async () => {
    const response = await fetch("/api/applications/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    return { status: response.status, body: await response.json() };
  });
  expect(malformed.status).toBe(400);
  expect(malformed.body).toMatchObject({ error: "Geçersiz JSON gövdesi." });

  const invalidTask = await page.request.post("/api/tasks", { data: {} });
  expect(invalidTask.status()).toBe(400);

  const missingId = "00000000-0000-0000-0000-000000000038";
  expect((await page.request.patch("/api/tasks", {
    data: { id: missingId, status: "completed" },
  })).status()).toBe(404);
  expect((await page.request.get(`/api/documents/${missingId}/download`)).status()).toBe(404);

  const beforeAudit = await e2eAdmin
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("type", "status");
  assertNoSupabaseError("Eşzamanlı geçiş öncesi audit sayısı okunamadı", beforeAudit);

  const transitionPayload = {
    applicationId,
    status: "evrak_hazirlaniyor",
  };
  const concurrentResponses = await Promise.all([
    page.request.patch("/api/applications/status", { data: transitionPayload }),
    page.request.patch("/api/applications/status", { data: transitionPayload }),
  ]);
  expect(concurrentResponses.map(response => response.status()).sort()).toEqual([200, 400]);

  const transitionedApplication = await e2eAdmin
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .single();
  assertNoSupabaseError("Eşzamanlı geçiş sonrası başvuru okunamadı", transitionedApplication);
  expect(transitionedApplication.data!.status).toBe("evrak_hazirlaniyor");

  const afterAudit = await e2eAdmin
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("type", "status");
  assertNoSupabaseError("Eşzamanlı geçiş sonrası audit sayısı okunamadı", afterAudit);
  expect(afterAudit.count).toBe((beforeAudit.count ?? 0) + 1);

  const firstTaskLoad = await page.request.get("/api/tasks");
  const secondTaskLoad = await page.request.get("/api/tasks");
  expect(firstTaskLoad.status()).toBe(200);
  expect(secondTaskLoad.status()).toBe(200);
  const firstTasks = await firstTaskLoad.json() as { tasks: Array<{ id: string }> };
  const secondTasks = await secondTaskLoad.json() as { tasks: Array<{ id: string }> };
  expect(firstTasks.tasks.map(task => task.id).sort()).toEqual(secondTasks.tasks.map(task => task.id).sort());

  const duplicateAutomaticTasks = await e2eAdmin
    .from("tasks")
    .select("idempotency_key")
    .eq("customer_id", customerId)
    .not("idempotency_key", "is", null);
  assertNoSupabaseError("Otomatik görev idempotency kayıtları okunamadı", duplicateAutomaticTasks);
  const keys = duplicateAutomaticTasks.data!.map(task => task.idempotency_key);
  expect(new Set(keys).size).toBe(keys.length);
});
