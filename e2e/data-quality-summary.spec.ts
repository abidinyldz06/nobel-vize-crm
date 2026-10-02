import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assertNoSupabaseError, createStaffIdentity, e2eAdmin, loginFromBrowser, purgeStaffFixtures } from "./support/supabase-fixtures";

// This test creates synthetic fixtures. Never run it against production.
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Data quality fixtures require an explicitly isolated local Supabase stack.");
}
const emails = ["phase58-admin@example.test", "phase58-consultant@example.test"];
const password = "Local-only-Phase58!2026";
let customerId = "";
let applicationId = "";
let adminStaffId = "";

test.beforeAll(async () => {
  await purgeStaffFixtures(emails);
  const admin = await createStaffIdentity({ email: emails[0], password, fullName: "Faz 5.8 Test Yöneticisi", role: "admin" });
  adminStaffId = admin.staffId;
  await createStaffIdentity({ email: emails[1], password, fullName: "Faz 5.8 Test Danışmanı", role: "consultant" });
  const customer = await e2eAdmin.from("customers").insert({
    first_name: "Sentetik", last_name: "Arşiv", email: "phase58-archive@example.test", phone: "05550005800",
    assigned_staff_id: admin.staffId, is_deleted: true, deleted_at: new Date().toISOString(),
  }).select("id").single();
  assertNoSupabaseError("Synthetic customer", customer);
  customerId = customer.data!.id;
  const application = await e2eAdmin.from("applications").insert({ customer_id: customerId, country: "Test", status: "profil_analizi", assigned_staff_id: admin.staffId }).select("id").single();
  assertNoSupabaseError("Synthetic application", application);
  applicationId = application.data!.id;
});

test.afterAll(async () => { await purgeStaffFixtures(emails); });

test("5.8 admin summary is private, aggregate-only and does not synchronize tasks", async ({ page }) => {
  await loginFromBrowser(page, emails[0], password);
  await expect(page).toHaveURL("/dashboard");
  const before = await e2eAdmin.from("tasks").select("id,status,completed_at,due_at").order("id");
  assertNoSupabaseError("Before tasks", before);
  const response = await page.request.get("/api/tasks/data-quality");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("private, no-store");
  const payload = await response.json();
  expect(payload.summary).toMatchObject({ openApplications: 0, insufficientSample: true, archivedOpenApplications: 1, missingFields: 0 });
  for (const privateValue of [customerId, applicationId, "phase58-archive@example.test", "05550005800"]) expect(JSON.stringify(payload)).not.toContain(privateValue);
  const after = await e2eAdmin.from("tasks").select("id,status,completed_at,due_at").order("id");
  assertNoSupabaseError("After tasks", after);
  expect(after.data).toEqual(before.data);
});

test("5.8 anonymous and consultant requests are rejected and consultants do not see the panel", async ({ page, request }) => {
  expect((await request.get("/api/tasks/data-quality")).status()).toBe(401);
  await loginFromBrowser(page, emails[1], password);
  await expect(page).toHaveURL("/dashboard");
  expect((await page.request.get("/api/tasks/data-quality")).status()).toBe(403);
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Görevler", exact: true })).toBeVisible();
  await expect(page.getByTestId("data-quality-panel")).toHaveCount(0);
});

test("5.8 panel shows insufficient sample, archive warning, mobile layout and explicit read failure", async ({ page }) => {
  await loginFromBrowser(page, emails[0], password);
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/tasks");
  const panel = page.getByTestId("data-quality-panel");
  await expect(panel.getByText(/operasyon başarısı için yeterli veri yok/)).toBeVisible();
  await expect(page.getByTestId("archived-open-applications")).toContainText("1 kapanmamış başvuru");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Ana menüyü aç' })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => {
    const box = await page.locator('#primary-sidebar').boundingBox();
    return box ? Math.round(box.x + box.width) : 0;
  }).toBeLessThanOrEqual(0);
  await expect(panel.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('[data-testid="data-quality-panel"]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await panel.screenshot({ path: "/private/tmp/crm-phase58-panel-mobile.png" });
  await page.route("**/api/tasks/data-quality", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) }));
  await page.reload();
  await expect(panel.getByRole("alert")).toContainText("sıfır eksiklik anlamına gelmez");
  await expect(panel.getByRole("table")).toHaveCount(0);
  await page.unroute("**/api/tasks/data-quality");
  await panel.getByRole("button", { name: "Özeti yeniden dene" }).click();
  await expect(panel.getByText(/operasyon başarısı için yeterli veri yok/)).toBeVisible();
});

test("5.8 inactive staff and admin sessions without required MFA cannot read the summary", async ({ page }) => {
  await loginFromBrowser(page, emails[0], password);
  await expect(page).toHaveURL("/dashboard");
  const policy = await e2eAdmin.from("tenants").select("id,admin_mfa_required").single();
  assertNoSupabaseError("Read local MFA policy", policy);
  try {
    assertNoSupabaseError("Require local test MFA", await e2eAdmin.from("tenants").update({ admin_mfa_required: true }).eq("id", policy.data!.id));
    expect((await page.request.get("/api/tasks/data-quality")).status()).toBe(403);
  } finally {
    assertNoSupabaseError("Restore local MFA policy", await e2eAdmin.from("tenants").update({ admin_mfa_required: policy.data!.admin_mfa_required }).eq("id", policy.data!.id));
  }
  try {
    assertNoSupabaseError("Deactivate test staff", await e2eAdmin.from("staff").update({ is_active: false }).eq("id", adminStaffId));
    expect((await page.request.get("/api/tasks/data-quality")).status()).toBe(403);
  } finally {
    assertNoSupabaseError("Restore test staff", await e2eAdmin.from("staff").update({ is_active: true }).eq("id", adminStaffId));
  }
});
