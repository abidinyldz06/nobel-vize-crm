import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  assertFixtureCleanup,
  createStaffIdentity,
  loginFromBrowser,
  purgeStaffFixtures,
  type StaffIdentity,
} from "./support/supabase-fixtures";

const adminEmail = "phase38-quality-admin@example.test";
const password = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Phase38-Quality!2026";
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

let adminIdentity: StaffIdentity;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.documentWidth,
    `Yatay taşma: belge ${dimensions.documentWidth}px, viewport ${dimensions.viewportWidth}px`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function expectWcagAA(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const summary = results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map(node => node.target),
  }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

test.beforeAll(async () => {
  await purgeStaffFixtures([adminEmail]);
  adminIdentity = await createStaffIdentity({
    email: adminEmail,
    password,
    fullName: "Faz 3.8 Kalite Yöneticisi",
    role: "admin",
  });
});

test.afterAll(async () => {
  await purgeStaffFixtures([adminEmail]);
  await assertFixtureCleanup([adminEmail]);
});

test("3.8.5 giriş ekranı mobil ve masaüstünde taşmaz, WCAG A/AA ihlali üretmez", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectWcagAA(page);
  }
});

test("3.8.5 masaüstü kritik ekranları, landmark ve klavye akışı kabul kriterlerini karşılar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginFromBrowser(page, adminIdentity.email, password);
  await expect(page).toHaveURL("/dashboard");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Ana içeriğe geç" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await expect(page.getByRole("complementary", { name: "Ana menü" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ana menüyü aç" })).toBeHidden();

  for (const route of ["/dashboard", "/customers", "/applications", "/tasks"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  for (const route of ["/dashboard", "/customers"]) {
    await page.goto(route);
    await expectWcagAA(page);
  }
});

test("3.8.5 mobil menü klavyeyle yönetilir ve kritik ekranlar yatay taşma üretmez", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginFromBrowser(page, adminIdentity.email, password);
  await expect(page).toHaveURL("/dashboard");

  const menuButton = page.getByRole("button", { name: "Ana menüyü aç" });
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toBeEnabled();
  await menuButton.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("complementary", { name: "Ana menü" })).toBeInViewport();

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();

  for (const route of ["/dashboard", "/customers", "/applications", "/tasks"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  for (const route of ["/dashboard", "/customers"]) {
    await page.goto(route);
    await expectWcagAA(page);
  }
});

test("3.8.5 dashboard ölçülebilir yükleme ve görsel kararlılık bütçelerini aşmaz", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const target = window as Window & { __phase38CumulativeLayoutShift?: number };
    target.__phase38CumulativeLayoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!layoutShift.hadRecentInput) {
          target.__phase38CumulativeLayoutShift =
            (target.__phase38CumulativeLayoutShift ?? 0) + layoutShift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await loginFromBrowser(page, adminIdentity.email, password);
  await expect(page).toHaveURL("/dashboard");
  const devTools = await page.context().newCDPSession(page);
  await devTools.send("Network.clearBrowserCache");
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const target = window as Window & { __phase38CumulativeLayoutShift?: number };
    return {
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      resourceCount: resources.length,
      transferBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
      cumulativeLayoutShift: target.__phase38CumulativeLayoutShift ?? 0,
    };
  });
  await testInfo.attach("performance-metrics.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });

  expect(metrics.domContentLoadedMs, JSON.stringify(metrics)).toBeLessThanOrEqual(4_000);
  expect(metrics.loadMs, JSON.stringify(metrics)).toBeLessThanOrEqual(5_000);
  expect(metrics.resourceCount, JSON.stringify(metrics)).toBeLessThanOrEqual(120);
  expect(metrics.transferBytes, JSON.stringify(metrics)).toBeLessThanOrEqual(4_000_000);
  expect(metrics.cumulativeLayoutShift, JSON.stringify(metrics)).toBeLessThanOrEqual(0.1);
});
