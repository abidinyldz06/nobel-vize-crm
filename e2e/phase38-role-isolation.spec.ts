import { expect, test } from "@playwright/test";
import {
  assertFixtureCleanup,
  assertNoSupabaseError,
  createAuthenticatedClient,
  createStaffIdentity,
  createUnlinkedAuthIdentity,
  e2eAdmin,
  loginFromBrowser,
  purgeStaffFixtures,
  type StaffIdentity,
} from "./support/supabase-fixtures";

const password = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Phase38!2026";
const emails = {
  admin: "phase38-admin@example.test",
  consultantA: "phase38-consultant-a@example.test",
  consultantB: "phase38-consultant-b@example.test",
  inactive: "phase38-inactive@example.test",
  unlinked: "phase38-unlinked@example.test",
};
const allEmails = Object.values(emails);

let adminIdentity: StaffIdentity;
let consultantA: StaffIdentity;
let consultantB: StaffIdentity;
let customerAId = "";
let customerBId = "";
let applicationBId = "";
let documentBId = "";

test.beforeAll(async () => {
  await purgeStaffFixtures(allEmails);

  adminIdentity = await createStaffIdentity({
    email: emails.admin,
    password,
    fullName: "Faz 3.8 Test Yöneticisi",
    role: "admin",
  });
  consultantA = await createStaffIdentity({
    email: emails.consultantA,
    password,
    fullName: "Faz 3.8 Danışman A",
    role: "consultant",
  });
  consultantB = await createStaffIdentity({
    email: emails.consultantB,
    password,
    fullName: "Faz 3.8 Danışman B",
    role: "consultant",
  });
  await createStaffIdentity({
    email: emails.inactive,
    password,
    fullName: "Faz 3.8 Pasif Danışman",
    role: "consultant",
    isActive: false,
  });
  await createUnlinkedAuthIdentity(emails.unlinked, password);

  const customers = await e2eAdmin
    .from("customers")
    .insert([
      {
        first_name: "RolMatris",
        last_name: "Müşteri A",
        email: "phase38-customer-a@example.test",
        phone: "05550003801",
        assigned_staff_id: consultantA.staffId,
      },
      {
        first_name: "RolMatris",
        last_name: "Müşteri B",
        email: "phase38-customer-b@example.test",
        phone: "05550003802",
        assigned_staff_id: consultantB.staffId,
      },
    ])
    .select("id, assigned_staff_id");
  assertNoSupabaseError("Rol matrisi müşterileri oluşturulamadı", customers);
  customerAId = customers.data!.find(row => row.assigned_staff_id === consultantA.staffId)!.id;
  customerBId = customers.data!.find(row => row.assigned_staff_id === consultantB.staffId)!.id;

  const applications = await e2eAdmin
    .from("applications")
    .insert([
      {
        customer_id: customerAId,
        assigned_staff_id: consultantA.staffId,
        country: "Faz 3.8 Ülke A",
        visa_type: "turistik",
      },
      {
        customer_id: customerBId,
        assigned_staff_id: consultantB.staffId,
        country: "Faz 3.8 Ülke B",
        visa_type: "is",
      },
    ])
    .select("id, assigned_staff_id");
  assertNoSupabaseError("Rol matrisi başvuruları oluşturulamadı", applications);
  const applicationAId = applications.data!.find(row => row.assigned_staff_id === consultantA.staffId)!.id;
  applicationBId = applications.data!.find(row => row.assigned_staff_id === consultantB.staffId)!.id;

  const document = await e2eAdmin
    .from("documents")
    .insert({
      application_id: applicationBId,
      document_type: "Faz 3.8 Gizli Evrak B",
      file_url: "phase38/private-b.pdf",
    })
    .select("id")
    .single();
  assertNoSupabaseError("Rol matrisi evrakı oluşturulamadı", document);
  documentBId = document.data!.id;

  for (const [label, promise] of [
    [
      "Rol matrisi notları oluşturulamadı",
      e2eAdmin.from("notes").insert([
        { application_id: applicationAId, content: "Danışman A özel notu", created_by: consultantA.staffId },
        { application_id: applicationBId, content: "Danışman B özel notu", created_by: consultantB.staffId },
      ]),
    ],
    [
      "Rol matrisi ödemeleri oluşturulamadı",
      e2eAdmin.from("payments").insert([
        { application_id: applicationAId, amount: 3801, status: "bekliyor" },
        { application_id: applicationBId, amount: 3802, status: "bekliyor" },
      ]),
    ],
    [
      "Rol matrisi görevleri oluşturulamadı",
      e2eAdmin.from("tasks").insert([
        {
          title: "Faz 3.8 Danışman A Görevi",
          assigned_staff_id: consultantA.staffId,
          created_by_staff_id: adminIdentity.staffId,
          customer_id: customerAId,
          application_id: applicationAId,
          due_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
        {
          title: "Faz 3.8 Danışman B Görevi",
          assigned_staff_id: consultantB.staffId,
          created_by_staff_id: adminIdentity.staffId,
          customer_id: customerBId,
          application_id: applicationBId,
          due_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      ]),
    ],
  ] as const) {
    assertNoSupabaseError(label, await promise);
  }
});

test.afterAll(async () => {
  await purgeStaffFixtures(allEmails);
  await assertFixtureCleanup(allEmails);
});

test("3.8.2 admin tüm kayıtları, danışman yalnız kendi müşterisini görür", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginFromBrowser(adminPage, emails.admin, password);
  await expect(adminPage).toHaveURL("/dashboard");
  await adminPage.goto("/customers");
  await expect(adminPage.getByText("RolMatris Müşteri A", { exact: true }).first()).toBeVisible();
  await expect(adminPage.getByText("RolMatris Müşteri B", { exact: true }).first()).toBeVisible();
  await expect(adminPage.getByRole("link", { name: "Personel" })).toBeVisible();
  await expect(adminPage.getByRole("link", { name: "Ülke & Evraklar" })).toBeVisible();
  await expect(adminPage.getByRole("link", { name: "Ayarlar" })).toBeVisible();
  await adminContext.close();

  const consultantContext = await browser.newContext();
  const consultantPage = await consultantContext.newPage();
  await loginFromBrowser(consultantPage, emails.consultantA, password);
  await expect(consultantPage).toHaveURL("/dashboard");
  await consultantPage.goto("/customers");
  await expect(consultantPage.getByText("RolMatris Müşteri A", { exact: true }).first()).toBeVisible();
  await expect(consultantPage.getByText("RolMatris Müşteri B", { exact: true })).toHaveCount(0);
  await expect(consultantPage.getByRole("link", { name: "Personel" })).toHaveCount(0);
  await expect(consultantPage.getByRole("link", { name: "Ülke & Evraklar" })).toHaveCount(0);
  await expect(consultantPage.getByRole("link", { name: "Ayarlar" })).toHaveCount(0);

  for (const path of [
    "/staff",
    "/staff/new",
    `/staff/${consultantB.staffId}/edit`,
    `/staff/${consultantB.staffId}/performance`,
    "/countries",
    "/settings",
    "/customers/archive",
  ]) {
    await consultantPage.goto(path);
    await expect(consultantPage).toHaveURL("/dashboard");
  }

  await consultantPage.goto(`/customers/${customerBId}`);
  await expect(consultantPage.getByText("Müşteri bulunamadı.")).toBeVisible();
  await consultantPage.goto(`/customers/${customerBId}/edit`);
  await expect(consultantPage.getByText("Müşteri bulunamadı.")).toBeVisible();
  await consultantPage.goto(`/customers/${customerBId}/appointment`);
  await expect(consultantPage.getByText("Müşteri bulunamadı.")).toBeVisible();
  await consultantContext.close();
});

test("3.8.2 danışman API ve doğrudan RLS üzerinden diğer danışmanın verisine erişemez", async ({ page }) => {
  await loginFromBrowser(page, emails.consultantA, password);
  await expect(page).toHaveURL("/dashboard");

  const searchResponse = await page.request.get("/api/search?q=RolMatris");
  expect(searchResponse.status()).toBe(200);
  const search = await searchResponse.json() as { customers: Array<{ id: string }> };
  expect(search.customers.map(customer => customer.id)).toEqual([customerAId]);

  const tasksResponse = await page.request.get("/api/tasks");
  expect(tasksResponse.status()).toBe(200);
  const taskPayload = await tasksResponse.json() as { tasks: Array<{ title: string }> };
  expect(taskPayload.tasks.map(task => task.title)).toContain("Faz 3.8 Danışman A Görevi");
  expect(taskPayload.tasks.map(task => task.title)).not.toContain("Faz 3.8 Danışman B Görevi");

  expect((await page.request.get(`/api/documents/${documentBId}/download`)).status()).toBe(404);
  expect((await page.request.get("/api/backup")).status()).toBe(403);
  expect((await page.request.post("/api/customers/bulk", {
    data: { action: "archive", customerIds: [customerAId] },
  })).status()).toBe(403);
  expect((await page.request.post("/api/customers/bulk", {
    data: { action: "assign_staff", customerIds: [customerAId], value: consultantB.staffId },
  })).status()).toBe(403);

  const consultantClient = await createAuthenticatedClient(emails.consultantA, password);
  const ownCustomers = await consultantClient
    .from("customers")
    .select("id")
    .in("id", [customerAId, customerBId])
    .order("id");
  assertNoSupabaseError("Danışman müşteri RLS sorgusu başarısız", ownCustomers);
  expect(ownCustomers.data!.map(customer => customer.id)).toEqual([customerAId]);

  for (const [label, promise] of [
    ["başvuru", consultantClient.from("applications").select("id").eq("id", applicationBId)],
    ["evrak", consultantClient.from("documents").select("id").eq("id", documentBId)],
    ["not", consultantClient.from("notes").select("id").eq("application_id", applicationBId)],
    ["ödeme", consultantClient.from("payments").select("id").eq("application_id", applicationBId)],
    ["görev", consultantClient.from("tasks").select("id").eq("assigned_staff_id", consultantB.staffId)],
    ["bildirim", consultantClient.from("notifications").select("id").eq("recipient_staff_id", consultantB.staffId)],
  ] as const) {
    const result = await promise;
    assertNoSupabaseError(`Danışman ${label} RLS sorgusu başarısız`, result);
    expect(result.data, `${label} verisi RLS ile gizlenmeli`).toHaveLength(0);
  }

  const crossUpdate = await consultantClient
    .from("customers")
    .update({ notes: "Yetkisiz güncelleme" })
    .eq("id", customerBId)
    .select("id");
  assertNoSupabaseError("RLS kontrollü çapraz güncelleme sorgusu başarısız", crossUpdate);
  expect(crossUpdate.data).toHaveLength(0);

  const adminClient = await createAuthenticatedClient(emails.admin, password);
  const adminCustomers = await adminClient
    .from("customers")
    .select("id")
    .in("id", [customerAId, customerBId]);
  assertNoSupabaseError("Admin müşteri RLS sorgusu başarısız", adminCustomers);
  expect(adminCustomers.data).toHaveLength(2);
});

test("3.8.2 pasif ve staff bağlantısı olmayan Auth hesapları iç CRM'e alınmaz", async ({ browser }) => {
  for (const [email, message] of [
    [emails.inactive, "Hesabınız pasif duruma alınmış."],
    [emails.unlinked, "Hesabınız personel kaydıyla eşleştirilmemiş."],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginFromBrowser(page, email, password);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/");
    await context.close();
  }
});
