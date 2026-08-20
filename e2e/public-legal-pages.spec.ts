import { expect, test } from "@playwright/test";

test("anonymous visitors can review the app and its public policies", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Nobel Vize CRM/);
  await expect(page.getByRole("heading", { name: /Vize süreçlerini düzenli/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Takvim bağlantısı isteğe bağlıdır." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Personel Girişi" }).first()).toHaveAttribute("href", "/login");

  await page.goto("/privacy-policy");
  await expect(page.getByRole("heading", { name: /Gizlilik Politikası/ })).toBeVisible();
  await expect(page.getByText(/Limited Use gereklilikleri/)).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Kullanım Şartları" })).toBeVisible();
  await expect(page.getByText(/Google Takvim bağlantısı isteğe bağlı/)).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Google ile devam et" })).toBeVisible();
});
