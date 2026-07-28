import { expect, test } from "@playwright/test";

test("new privacy cron is secret protected", async ({ request }) => {
  const response = await request.get("/api/cron/privacy");
  expect(response.status()).toBe(401);
  expect(response.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
});

test("anonymous users cannot access lead, privacy or appointment operations", async ({ page, request }) => {
  for (const path of ["/leads", "/privacy", "/appointments"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  }
  expect((await request.get("/api/reports/export.csv")).status()).toBe(401);
  expect((await request.get("/api/reports/export.pdf")).status()).toBe(401);
  expect((await request.get("/api/appointments/00000000-0000-0000-0000-000000000000/ics")).status()).toBe(401);
  expect((await request.patch("/api/appointments/00000000-0000-0000-0000-000000000000/status", { data: { status: "completed" } })).status()).toBe(401);
});
