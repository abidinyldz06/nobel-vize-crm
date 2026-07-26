import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { expect, test } from "@playwright/test";
import WebSocket from "ws";
import type { Database } from "../src/types/database";

const testEmail = "phase37-admin@example.test";
const testPassword = process.env.E2E_STAFF_PASSWORD ?? "E2E-only-Phase37!2026";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Phase 3.7 E2E tests require local Supabase environment variables.");
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
});

let userId: string | null = null;
let staffId: string | null = null;

test.beforeAll(async () => {
  await admin.from("notifications").delete().eq("type", "operation");
  await admin.from("backup_runs").delete().like("artifact_label", "nobel-vize-backup-v2-%");
  await admin.from("operational_events").delete().in("event_key", [
    "backup.stale",
    "health.readiness.failed",
  ]);
  await admin.from("staff").delete().eq("email", testEmail);

  const users = await admin.auth.admin.listUsers();
  if (users.error) throw users.error;
  for (const user of users.data.users.filter(candidate => candidate.email === testEmail)) {
    const deletion = await admin.auth.admin.deleteUser(user.id);
    if (deletion.error) throw deletion.error;
  }

  const created = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const staff = await admin.from("staff").insert({
    user_id: userId,
    full_name: "Faz 3.7 Yöneticisi",
    email: testEmail,
    role: "admin",
    is_active: true,
  }).select("id").single();
  if (staff.error) throw staff.error;
  staffId = staff.data.id;
});

test.afterAll(async () => {
  await admin.from("notifications").delete().eq("type", "operation");
  await admin.from("backup_runs").delete().like("artifact_label", "nobel-vize-backup-v2-%");
  await admin.from("operational_events").delete().in("event_key", [
    "backup.stale",
    "health.readiness.failed",
  ]);
  if (staffId) await admin.from("staff").delete().eq("id", staffId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("admin observes stale backup and creates a verified database and Storage inventory", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/");
  await page.getByRole("textbox", { name: "E-posta Adresi" }).fill(testEmail);
  await page.getByLabel("Şifre").fill(testPassword);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/settings?tab=operations");
  const operations = page.getByTestId("operations-panel");
  await expect(operations).toBeVisible();
  await operations.getByRole("button", { name: "Şimdi kontrol et" }).click();
  await expect(operations.getByText("Hazır", { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const event = await admin.from("operational_events")
      .select("status, occurrence_count")
      .eq("event_key", "backup.stale")
      .eq("status", "open")
      .maybeSingle();
    if (event.error) throw event.error;
    return event.data?.status ?? null;
  }).toBe("open");

  await page.getByRole("button", { name: "Veri Yedekleme" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Yedeği İndir ve Doğrula" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^nobel-vize-backup-v2-.*\.json$/);

  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Backup download path is unavailable.");
  const payload = JSON.parse(await readFile(downloadPath, "utf8")) as {
    backup_run_id?: string;
    storage?: {
      included?: boolean;
      object_count?: number;
      total_bytes?: number;
      manifest?: unknown[];
    };
  };
  expect(payload.backup_run_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(payload.storage?.included).toBe(false);
  expect(payload.storage?.manifest).toHaveLength(payload.storage?.object_count ?? 0);
  expect(payload.storage?.total_bytes).toBeGreaterThanOrEqual(0);

  await expect.poll(async () => {
    const run = await admin.from("backup_runs")
      .select("status, checksum_sha256, database_table_count, storage_object_count")
      .eq("id", payload.backup_run_id!)
      .single();
    if (run.error) throw run.error;
    return {
      status: run.data.status,
      checksumLength: run.data.checksum_sha256?.length ?? 0,
      hasTables: (run.data.database_table_count ?? 0) > 0,
      storageCount: run.data.storage_object_count,
    };
  }).toEqual({
    status: "verified",
    checksumLength: 64,
    hasTables: true,
    storageCount: payload.storage?.object_count ?? 0,
  });

  await expect.poll(async () => {
    const stale = await admin.from("operational_events")
      .select("status")
      .eq("event_key", "backup.stale")
      .maybeSingle();
    if (stale.error) throw stale.error;
    return stale.data?.status ?? null;
  }).toBe("resolved");
});
