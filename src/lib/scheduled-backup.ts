import "server-only";

import { decryptBackupPayload, encryptBackupPayload, parseBackupEncryptionKey, sha256Hex } from "@/lib/backup-crypto";
import { errorCodeFrom } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Database } from "@/types/database";

const TABLES = [
  "tenants", "staff", "security_events", "scheduled_job_runs",
  "privacy_settings", "privacy_notice_versions",
  "message_templates", "tags", "countries", "country_visa_rules",
  "customers", "customer_privacy_notices", "customer_consents", "communication_preferences",
  "data_subject_requests", "customer_tags", "applications", "documents",
  "notes", "payments", "activity_log", "communications", "message_outbox", "tasks",
  "notifications", "visa_history", "family_members", "webhook_events",
] as const;

const MAX_DATABASE_ROWS = 100_000;
const MAX_STORAGE_OBJECTS = 2_000;
const MAX_PLAINTEXT_BYTES = 40 * 1024 * 1024;
const PAGE_SIZE = 1_000;
const STORAGE_PAGE_SIZE = 100;
const RETENTION = { daily: 14, weekly: 8, monthly: 12 } as const;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type PublicTable = keyof Database["public"]["Tables"];
type Cadence = keyof typeof RETENTION;

interface StorageBackupObject {
  path: string;
  content_base64: string;
  size: number;
  sha256: string;
  updated_at: string | null;
}

interface ContinuityPayload {
  format: "nobel-vize-crm-continuity";
  version: "3.0";
  recovery_point_id: string;
  exported_at: string;
  database: { table_count: number; row_count: number; tables: Record<string, unknown[]> };
  storage: { bucket: "documents"; object_count: number; total_bytes: number; objects: StorageBackupObject[] };
}

async function exportTable(admin: AdminClient, table: typeof TABLES[number]) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table as PublicTable)
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (rows.length > MAX_DATABASE_ROWS) {
      throw Object.assign(new Error("backup_database_row_limit"), { code: "backup_database_row_limit" });
    }
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function listStoragePaths(admin: AdminClient, prefix = "", depth = 0): Promise<Array<{ path: string; updated_at: string | null }>> {
  if (depth > 20) throw Object.assign(new Error("backup_storage_depth"), { code: "backup_storage_depth" });
  const output: Array<{ path: string; updated_at: string | null }> = [];
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await admin.storage.from("documents").list(prefix, {
      limit: STORAGE_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const page = data ?? [];
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) output.push({ path, updated_at: item.updated_at ?? null });
      else output.push(...await listStoragePaths(admin, path, depth + 1));
      if (output.length > MAX_STORAGE_OBJECTS) {
        throw Object.assign(new Error("backup_storage_object_limit"), { code: "backup_storage_object_limit" });
      }
    }
    if (page.length < STORAGE_PAGE_SIZE) break;
  }
  return output;
}

async function exportStorage(admin: AdminClient) {
  const paths = await listStoragePaths(admin);
  const objects: StorageBackupObject[] = [];
  for (const item of paths) {
    const { data, error } = await admin.storage.from("documents").download(item.path);
    if (error || !data) throw error ?? new Error("backup_storage_download_failed");
    const bytes = new Uint8Array(await data.arrayBuffer());
    objects.push({
      path: item.path,
      content_base64: Buffer.from(bytes).toString("base64"),
      size: bytes.byteLength,
      sha256: await sha256Hex(bytes),
      updated_at: item.updated_at,
    });
  }
  return objects;
}

function cadenceTargets(now: Date): Cadence[] {
  const targets: Cadence[] = ["daily"];
  if (now.getUTCDay() === 0) targets.push("weekly");
  if (now.getUTCDate() === 1) targets.push("monthly");
  return targets;
}

async function enforceRetention(admin: AdminClient, cadence: Cadence) {
  const { data, error } = await admin.storage.from("continuity-backups").list(cadence, {
    limit: 100,
    sortBy: { column: "name", order: "desc" },
  });
  if (error) throw error;
  const stale = (data ?? []).filter(item => Boolean(item.id)).slice(RETENTION[cadence]);
  if (stale.length === 0) return;
  const { error: removeError } = await admin.storage
    .from("continuity-backups")
    .remove(stale.map(item => `${cadence}/${item.name}`));
  if (removeError) throw removeError;
}

async function verifyPlaintext(plaintext: Uint8Array) {
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as ContinuityPayload;
  if (parsed.format !== "nobel-vize-crm-continuity" || parsed.version !== "3.0") {
    throw Object.assign(new Error("backup_payload_invalid"), { code: "backup_payload_invalid" });
  }
  for (const object of parsed.storage.objects) {
    const bytes = Uint8Array.from(Buffer.from(object.content_base64, "base64"));
    if (bytes.byteLength !== object.size || await sha256Hex(bytes) !== object.sha256) {
      throw Object.assign(new Error("backup_storage_integrity_failed"), { code: "backup_storage_integrity_failed" });
    }
  }
  return parsed;
}

export async function runScheduledBackup(now = new Date()) {
  const admin = createSupabaseAdminClient();
  const windowKey = now.toISOString().slice(0, 10);
  const { data: existing, error: existingError } = await admin
    .from("scheduled_job_runs")
    .select("id, status")
    .eq("job_name", "backup")
    .eq("window_key", windowKey)
    .maybeSingle();
  if (existingError) throw existingError;

  let scheduledRun: { id: string } | null = null;
  if (existing?.status === "failed") {
    const { data: retriedRun, error: retryError } = await admin
      .from("scheduled_job_runs")
      .update({
        status: "started",
        inserted_count: 0,
        error_code: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (retryError) throw retryError;
    if (!retriedRun) {
      return { status: "skipped" as const, reason: "window_retry_in_progress" };
    }
    scheduledRun = retriedRun;
  } else if (existing) {
    return { status: "skipped" as const, reason: "window_already_processed" };
  } else {
    const { data: insertedRun, error: scheduledError } = await admin
      .from("scheduled_job_runs")
      .insert({ job_name: "backup", window_key: windowKey })
      .select("id")
      .single();
    if (scheduledError?.code === "23505") {
      return { status: "skipped" as const, reason: "window_already_processed" };
    }
    if (scheduledError || !insertedRun) {
      throw scheduledError ?? new Error("backup_schedule_not_started");
    }
    scheduledRun = insertedRun;
  }

  let backupRunId: string | null = null;
  try {
    const recoveryPointId = crypto.randomUUID();
    const artifactLabel = `continuity-${now.toISOString().replace(/[:.]/g, "-")}.nvb`;
    const { data: started, error: startError } = await admin.rpc("start_backup_run_v1", {
      p_backup_kind: "full",
      p_trigger_type: "scheduled",
      p_artifact_label: artifactLabel,
    });
    if (startError || !started) throw startError ?? new Error("backup_run_not_started");
    backupRunId = started;

    const tableEntries = await Promise.all(TABLES.map(async table => [table, await exportTable(admin, table)] as const));
    const tables = Object.fromEntries(tableEntries);
    const storageObjects = await exportStorage(admin);
    const payload: ContinuityPayload = {
      format: "nobel-vize-crm-continuity",
      version: "3.0",
      recovery_point_id: recoveryPointId,
      exported_at: now.toISOString(),
      database: {
        table_count: TABLES.length,
        row_count: Object.values(tables).reduce((sum, rows) => sum + rows.length, 0),
        tables,
      },
      storage: {
        bucket: "documents",
        object_count: storageObjects.length,
        total_bytes: storageObjects.reduce((sum, object) => sum + object.size, 0),
        objects: storageObjects,
      },
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
      throw Object.assign(new Error("backup_plaintext_limit"), { code: "backup_plaintext_limit" });
    }
    const rawKey = parseBackupEncryptionKey(process.env.BACKUP_ENCRYPTION_KEY);
    const encrypted = await encryptBackupPayload(plaintext, rawKey);
    const decrypted = await decryptBackupPayload(encrypted, rawKey);
    const verified = await verifyPlaintext(decrypted);
    if (verified.recovery_point_id !== recoveryPointId) throw new Error("backup_recovery_point_mismatch");
    const checksum = await sha256Hex(encrypted);

    for (const cadence of cadenceTargets(now)) {
      const path = `${cadence}/${artifactLabel}`;
      const { error: uploadError } = await admin.storage
        .from("continuity-backups")
        .upload(path, encrypted, { contentType: "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      await enforceRetention(admin, cadence);
    }

    const { data: completed, error: completeError } = await admin.rpc("complete_backup_run_v1", {
      p_run_id: backupRunId,
      p_database_table_count: payload.database.table_count,
      p_database_row_count: payload.database.row_count,
      p_storage_object_count: payload.storage.object_count,
      p_storage_bytes: payload.storage.total_bytes,
      p_checksum_sha256: checksum,
    });
    if (completeError || !completed) throw completeError ?? new Error("backup_run_not_completed");
    const { data: verifiedRun, error: verifyError } = await admin.rpc("verify_backup_run_v1", {
      p_run_id: backupRunId,
      p_checksum_sha256: checksum,
    });
    if (verifyError || !verifiedRun) throw verifyError ?? new Error("backup_run_not_verified");

    await admin.from("scheduled_job_runs").update({
      status: "succeeded",
      inserted_count: cadenceTargets(now).length,
      completed_at: new Date().toISOString(),
    }).eq("id", scheduledRun.id);
    return {
      status: "succeeded" as const,
      recovery_point_id: recoveryPointId,
      database_rows: payload.database.row_count,
      storage_objects: payload.storage.object_count,
    };
  } catch (error) {
    const errorCode = errorCodeFrom(error);
    if (backupRunId) {
      await admin.rpc("fail_backup_run_v1", { p_run_id: backupRunId, p_error_code: errorCode });
    }
    await admin.from("scheduled_job_runs").update({
      status: "failed",
      error_code: errorCode,
      completed_at: new Date().toISOString(),
    }).eq("id", scheduledRun.id);
    throw error;
  }
}
