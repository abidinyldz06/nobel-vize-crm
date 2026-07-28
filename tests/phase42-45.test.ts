import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { decryptBackupPayload, encryptBackupPayload, parseBackupEncryptionKey, sha256Hex } from "../src/lib/backup-crypto.ts";
import { isAuthorizedCronRequest, scheduledWindowKey } from "../src/lib/cron-auth.ts";
import { loginAttemptKey, retryAfterMessage } from "../src/lib/login-security.ts";

const root = process.cwd();

describe("phase 4.2 scheduled operations", () => {
  it("uses a fail-closed constant-time cron secret gate", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, secret), true);
    assert.equal(isAuthorizedCronRequest("Bearer wrong", secret), false);
    assert.equal(isAuthorizedCronRequest(null, secret), false);
    assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, "short"), false);
    assert.equal(scheduledWindowKey(new Date("2026-07-28T09:47:00Z")), "2026-07-28T09:00:00Z");
  });

  it("keeps cron execution service-only, locked and idempotent", async () => {
    const migration = await readFile(path.join(root, "supabase/migrations/202607280002_phase42_scheduled_operations.sql"), "utf8");
    const route = await readFile(path.join(root, "src/app/api/cron/operations/route.ts"), "utf8");
    assert.match(migration, /service_role_required/);
    assert.match(migration, /pg_try_advisory_xact_lock/);
    assert.match(migration, /UNIQUE \(job_name, window_key\)/);
    assert.match(migration, /'passport:'/);
    assert.match(route, /isAuthorizedCronRequest/);
    assert.doesNotMatch(route, /console\.(log|error)/);
  });
});

describe("phase 4.3 encrypted continuity backup", () => {
  it("round-trips and authenticates AES-256-GCM artifacts", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const payload = new TextEncoder().encode('{"recovery_point_id":"test"}');
    const encrypted = await encryptBackupPayload(payload, rawKey);
    assert.notDeepEqual(encrypted, payload);
    assert.deepEqual(await decryptBackupPayload(encrypted, rawKey), payload);
    const tampered = encrypted.slice();
    tampered[tampered.length - 1] ^= 1;
    await assert.rejects(() => decryptBackupPayload(tampered, rawKey));
    assert.equal((await sha256Hex(encrypted)).length, 64);
  });

  it("requires an exact 32-byte base64 key and preserves retention tiers", async () => {
    assert.equal(parseBackupEncryptionKey(Buffer.alloc(32, 7).toString("base64")).byteLength, 32);
    assert.throws(() => parseBackupEncryptionKey(undefined));
    assert.throws(() => parseBackupEncryptionKey(Buffer.alloc(16).toString("base64")));
    const source = await readFile(path.join(root, "src/lib/scheduled-backup.ts"), "utf8");
    assert.match(source, /daily: 14, weekly: 8, monthly: 12/);
    assert.match(source, /content_base64/);
    assert.match(source, /backup_storage_integrity_failed/);
    assert.match(source, /continuity-backups/);
  });

  it("retries failed daily windows and permits service-owned event resolution", async () => {
    const [source, migration] = await Promise.all([
      readFile(path.join(root, "src/lib/scheduled-backup.ts"), "utf8"),
      readFile(path.join(root, "supabase/migrations/202607280007_phase43_service_backup_resolution.sql"), "utf8"),
    ]);
    assert.match(source, /existing\?\.status === "failed"/);
    assert.match(source, /window_retry_in_progress/);
    assert.match(migration, /status = 'resolved' AND resolved_at IS NOT NULL/);
    assert.doesNotMatch(migration, /status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by_staff_id IS NOT NULL/);
  });
});

describe("phase 4.4 account security", () => {
  it("creates stable pseudonymous login keys without retaining credentials", () => {
    const first = loginAttemptKey(" ADMIN@EXAMPLE.COM ", "203.0.113.9, 10.0.0.1");
    const second = loginAttemptKey("admin@example.com", "203.0.113.9");
    assert.equal(first, second);
    assert.equal(first.length, 64);
    assert.equal(retryAfterMessage(61), "Çok fazla başarısız giriş denemesi yapıldı. 2 dakika sonra tekrar deneyin.");
  });

  it("enforces MFA close to protected data and supports other-session revocation", async () => {
    const [authz, panel, migration] = await Promise.all([
      readFile(path.join(root, "src/lib/authz.ts"), "utf8"),
      readFile(path.join(root, "src/components/AccountSecurityPanel.tsx"), "utf8"),
      readFile(path.join(root, "supabase/migrations/202607280004_phase44_account_security.sql"), "utf8"),
    ]);
    assert.match(authz, /getAuthenticatorAssuranceLevel/);
    assert.match(authz, /currentLevel !== "aal2"/);
    assert.match(panel, /scope: "others"/);
    assert.match(migration, /failure_count[\s\S]*>= 5/);
    assert.match(migration, /interval '15 minutes'/);
    assert.doesNotMatch(migration, /\b(password|credential|token)_(hash|value|plaintext)\b/i);
  });
});

describe("phase 4.5 provider-neutral messaging foundation", () => {
  it("defaults to provider-disabled and keeps fallback delivery claims manual", async () => {
    const [provider, composer, migration, webhook] = await Promise.all([
      readFile(path.join(root, "src/lib/message-provider.ts"), "utf8"),
      readFile(path.join(root, "src/components/MessageComposer.tsx"), "utf8"),
      readFile(path.join(root, "supabase/migrations/202607280005_phase45_message_outbox_foundation.sql"), "utf8"),
      readFile(path.join(root, "src/app/api/webhook/messages/route.ts"), "utf8"),
    ]);
    assert.match(provider, /return null/);
    assert.match(provider, /message_provider_not_implemented/);
    assert.match(composer, /mailto:/);
    assert.match(composer, /wa\.me/);
    assert.match(migration, /communication_permission_required/);
    assert.match(migration, /marketing_consent_required/);
    assert.match(migration, /UNIQUE/);
    assert.match(webhook, /verifySignedWebhookWithSecret/);
    assert.match(webhook, /23505/);
  });
});
