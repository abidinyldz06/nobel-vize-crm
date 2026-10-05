import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assuranceFromAccessToken,
  clientSuppliedStaffId,
  decodeTaskCursor,
  encodeTaskCursor,
  mapMobileTask,
  mobileMfaRequired,
  publicAuthMessage,
} from "../src/lib/mobile-contract";

const root = process.cwd();

test("admin MFA boş politikada da zorunlu kalır", () => {
  assert.equal(mobileMfaRequired("admin", { admin_mfa_required: null, consultant_mfa_required: null }), true);
  assert.equal(mobileMfaRequired("admin", { admin_mfa_required: false, consultant_mfa_required: true }), false);
  assert.equal(mobileMfaRequired("consultant", { admin_mfa_required: true, consultant_mfa_required: true }), true);
  assert.equal(mobileMfaRequired("consultant", { admin_mfa_required: true, consultant_mfa_required: false }), false);
});

test("doğrulanmış tokenın AAL alanı okunur", () => {
  const token = `h.${Buffer.from(JSON.stringify({ aal: "aal1" })).toString("base64url")}.s`;
  assert.equal(assuranceFromAccessToken(token), "aal1");
  assert.equal(assuranceFromAccessToken("not-a-jwt"), null);
});

test("görev cevabı müşteri alanı taşımaz ve acil önceliği yüksek sayar", () => {
  const task = mapMobileTask({
    id: "5f6d7c2a-1b34-4a5e-8c90-123456789abc",
    title: "Evrak",
    description: "Liste",
    due_at: "2026-10-06T09:00:00.000Z",
    priority: "urgent",
    status: "pending",
  });
  assert.deepEqual(task, {
    id: "5f6d7c2a-1b34-4a5e-8c90-123456789abc",
    title: "Evrak",
    detail: "Liste",
    dueAt: "2026-10-06T09:00:00.000Z",
    priority: "high",
    status: "open",
  });
  assert.equal(JSON.stringify(task).includes("customer"), false);
});

test("sayfa imi ve istemci personel parametresi denetlenir", () => {
  const cursor = encodeTaskCursor("2026-10-06T09:00:00.000Z", "5f6d7c2a-1b34-4a5e-8c90-123456789abc");
  assert.deepEqual(decodeTaskCursor(cursor), {
    dueAt: "2026-10-06T09:00:00.000Z",
    id: "5f6d7c2a-1b34-4a5e-8c90-123456789abc",
  });
  assert.equal(decodeTaskCursor("%%%"), null);
  assert.equal(clientSuppliedStaffId(new URL("https://crm.example/api/mobile/v1/tasks?staff_id=1")), true);
  assert.equal(clientSuppliedStaffId(new URL("https://crm.example/api/mobile/v1/tasks")), false);
});

test("hata metni parolayı geri vermez", () => {
  assert.equal(publicAuthMessage("olmadı gizli-parola", "gizli-parola"), "Giriş tamamlanamadı.");
});

test("mobil görev okuması senkronizasyon ve service-role kullanmaz", async () => {
  const files = [
    "src/app/api/mobile/v1/tasks/route.ts",
    "src/app/api/mobile/v1/me/route.ts",
    "src/app/api/mobile/v1/auth/mfa/route.ts",
    "src/app/api/mobile/v1/auth/logout/route.ts",
    "src/lib/mobile-session.ts",
  ];
  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /sync_operational_tasks/);
    assert.doesNotMatch(source, /supabase-admin/);
    assert.doesNotMatch(source, /SERVICE_ROLE/);
  }
});
