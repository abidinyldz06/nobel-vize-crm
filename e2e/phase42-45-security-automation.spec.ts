import { expect, test } from "@playwright/test";

test("cron endpoints reject requests without the server secret", async ({ request }) => {
  for (const path of ["/api/cron/operations", "/api/cron/backup", "/api/cron/messages"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});

test("anonymous users cannot open MFA or account security pages", async ({ page }) => {
  await page.goto("/mfa");
  await expect(page).toHaveURL("/");
  await page.goto("/account/security");
  await expect(page).toHaveURL("/");
});
