import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";
import {
  errorCodeFrom,
  isRequestId,
  observedRoute,
  requestIdFrom,
  structuredLog,
} from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/types/database";

const TABLES_ORDER = [
  "tenants",
  "staff",
  "security_events",
  "scheduled_job_runs",
  "privacy_settings",
  "privacy_notice_versions",
  "message_templates",
  "tags",
  "countries",
  "country_visa_rules",
  "customers",
  "customer_privacy_notices",
  "customer_consents",
  "communication_preferences",
  "data_subject_requests",
  "privacy_action_queue",
  "privacy_action_approvals",
  "privacy_audit_log",
  "leads",
  "lead_events",
  "customer_tags",
  "applications",
  "appointment_events",
  "documents",
  "notes",
  "payments",
  "activity_log",
  "communications",
  "message_outbox",
  "tasks",
  "notifications",
  "visa_history",
  "family_members",
  "webhook_events",
] as const;

type BackupTable = typeof TABLES_ORDER[number];

const TABLE_ORDER_COLUMNS: Record<BackupTable, string> = {
  tenants: "id",
  staff: "id",
  security_events: "id",
  scheduled_job_runs: "id",
  privacy_settings: "id",
  privacy_notice_versions: "id",
  message_templates: "id",
  tags: "id",
  countries: "id",
  country_visa_rules: "id",
  customers: "id",
  customer_privacy_notices: "id",
  customer_consents: "id",
  communication_preferences: "customer_id",
  data_subject_requests: "id",
  privacy_action_queue: "id",
  privacy_action_approvals: "id",
  privacy_audit_log: "id",
  leads: "id",
  lead_events: "id",
  customer_tags: "customer_id",
  applications: "id",
  appointment_events: "id",
  documents: "id",
  notes: "id",
  payments: "id",
  activity_log: "id",
  communications: "id",
  message_outbox: "id",
  tasks: "id",
  notifications: "id",
  visa_history: "id",
  family_members: "id",
  webhook_events: "event_id",
};

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const PAGE_SIZE = 1000;
const STORAGE_PAGE_SIZE = 100;
const MAX_STORAGE_OBJECTS = 10_000;

interface BackupV2 {
  format: "nobel-vize-crm-backup";
  version: "2.0";
  backup_run_id?: string;
  exported_at: string;
  schema: "phase1";
  storage: {
    included: false;
    bucket: "documents";
    object_count: number;
    total_bytes: number;
    manifest: StorageManifestItem[];
    note: string;
  };
  tables: Record<string, unknown[]>;
}

interface StorageManifestItem {
  path: string;
  size: number;
  updated_at: string | null;
}

const OPTIONAL_V2_TABLES = new Set<BackupTable>([
  "message_templates",
  "tags",
  "customer_tags",
  "tasks",
  "notifications",
  "privacy_settings",
  "privacy_notice_versions",
  "customer_privacy_notices",
  "customer_consents",
  "data_subject_requests",
  "privacy_action_queue",
  "privacy_action_approvals",
  "privacy_audit_log",
  "leads",
  "lead_events",
  "appointment_events",
  "security_events",
  "scheduled_job_runs",
  "communication_preferences",
  "message_outbox",
]);

function isBackupV2(value: unknown): value is BackupV2 {
  if (!value || typeof value !== "object") return false;
  const backup = value as Record<string, unknown>;
  if (backup.format !== "nobel-vize-crm-backup" || backup.version !== "2.0") return false;
  if (!backup.tables || typeof backup.tables !== "object" || Array.isArray(backup.tables)) return false;
  const tables = backup.tables as Record<string, unknown>;
  return TABLES_ORDER.every(table => OPTIONAL_V2_TABLES.has(table) || Array.isArray(tables[table]))
    && TABLES_ORDER.every(table => tables[table] === undefined || Array.isArray(tables[table]));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function storageObjectSize(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("size" in metadata)) return 0;
  const size = Number(metadata.size);
  return Number.isFinite(size) && size >= 0 ? size : 0;
}

async function exportStorageManifest(prefix = "", depth = 0): Promise<StorageManifestItem[]> {
  if (depth > 20) throw Object.assign(new Error("storage_manifest_depth"), { code: "storage_manifest_depth" });

  const admin = createSupabaseAdminClient();
  const records: StorageManifestItem[] = [];
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await admin.storage
      .from("documents")
      .list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw error;

    const page = data ?? [];
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) {
        records.push(...await exportStorageManifest(path, depth + 1));
      } else {
        records.push({
          path,
          size: storageObjectSize(item.metadata),
          updated_at: item.updated_at ?? null,
        });
      }
      if (records.length > MAX_STORAGE_OBJECTS) {
        throw Object.assign(new Error("storage_manifest_limit"), { code: "storage_manifest_limit" });
      }
    }
    if (page.length < STORAGE_PAGE_SIZE) break;
  }
  return records;
}

async function exportTable(table: BackupTable): Promise<unknown[]> {
  const supabase = createSupabaseAdminClient();
  const records: unknown[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(TABLE_ORDER_COLUMNS[table], { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to export ${table}: ${error.message}`);
    const page = data ?? [];
    records.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return records;
}

async function exportBackup(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  let backupRunId: string | null = null;
  try {
    const exportedAt = new Date();
    const artifactLabel = `nobel-vize-backup-v2-${exportedAt.toISOString().replace(/[:.]/g, "-")}.json`;
    const { data: startedRunId, error: startError } = await supabase.rpc("start_backup_run_v1", {
      p_backup_kind: "full",
      p_trigger_type: "manual",
      p_artifact_label: artifactLabel,
    });
    if (startError || !startedRunId) throw startError ?? new Error("backup_run_not_started");
    backupRunId = startedRunId;

    const [tableEntries, storageManifest] = await Promise.all([
      Promise.all(TABLES_ORDER.map(async table => [table, await exportTable(table)] as const)),
      exportStorageManifest(),
    ]);
    const tables = Object.fromEntries(tableEntries) as Record<string, unknown[]>;
    const storageBytes = storageManifest.reduce((total, item) => total + item.size, 0);

    const backup: BackupV2 = {
      format: "nobel-vize-crm-backup",
      version: "2.0",
      backup_run_id: backupRunId,
      exported_at: exportedAt.toISOString(),
      schema: "phase1",
      storage: {
        included: false,
        bucket: "documents",
        object_count: storageManifest.length,
        total_bytes: storageBytes,
        manifest: storageManifest,
        note: "Storage envanteri dahildir; dosya binary'leri bu JSON yedegine dahil degildir.",
      },
      tables,
    };
    const serializedBackup = JSON.stringify(backup, null, 2);
    const checksum = await sha256Hex(serializedBackup);
    const databaseRowCount = Object.values(tables)
      .reduce((total, rows) => total + rows.length, 0);
    const { data: completed, error: completeError } = await supabase.rpc(
      "complete_backup_run_v1",
      {
        p_run_id: backupRunId,
        p_database_table_count: TABLES_ORDER.length,
        p_database_row_count: databaseRowCount,
        p_storage_object_count: storageManifest.length,
        p_storage_bytes: storageBytes,
        p_checksum_sha256: checksum,
      },
    );
    if (completeError || !completed) throw completeError ?? new Error("backup_run_not_completed");

    return new NextResponse(serializedBackup, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${artifactLabel}"`,
        "Cache-Control": "no-store",
        "X-Backup-Run-Id": backupRunId,
        "X-Backup-SHA256": checksum,
      },
    });
  } catch (error: unknown) {
    const requestId = requestIdFrom(request);
    const errorCode = errorCodeFrom(error);
    if (backupRunId) {
      await supabase.rpc("fail_backup_run_v1", {
        p_run_id: backupRunId,
        p_error_code: errorCode,
      });
    }
    structuredLog("error", "backup.export.failed", {
      requestId,
      operation: "backup.export",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "backup.export.failed",
      severity: "error",
      source: "backup",
      requestId,
      route: "/api/backup",
      errorCode,
    });
    return NextResponse.json({ error: "Yedek oluşturulamadı." }, { status: 500 });
  }
}

async function restoreBackup(req: Request) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  if (process.env.ENABLE_ATOMIC_RESTORE !== "true") {
    return NextResponse.json(
      { error: "Atomik geri yükleme bu ortamda devre dışı." },
      { status: 503 },
    );
  }

  if (req.headers.get("x-confirm-restore") !== "RESTORE_BACKUP_V2") {
    return NextResponse.json({ error: "Geri yükleme onay başlığı eksik." }, { status: 400 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Yedek dosyası 25 MB sınırını aşıyor." }, { status: 413 });
  }

  let rawBackup: string;
  try {
    rawBackup = await req.text();
  } catch {
    return NextResponse.json({ error: "Yedek dosyası okunamadı." }, { status: 400 });
  }

  if (new TextEncoder().encode(rawBackup).byteLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Yedek dosyası 25 MB sınırını aşıyor." }, { status: 413 });
  }

  let backupData: unknown;
  try {
    backupData = JSON.parse(rawBackup);
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON yedek dosyası." }, { status: 400 });
  }

  if (!isBackupV2(backupData)) {
    return NextResponse.json({ error: "Yalnızca doğrulanmış v2 yedekleri geri yüklenebilir." }, { status: 400 });
  }

  let integrityVerified = false;
  if (backupData.backup_run_id !== undefined) {
    if (!isRequestId(backupData.backup_run_id)) {
      return NextResponse.json({ error: "Geçersiz yedek çalışma kimliği." }, { status: 400 });
    }
    const checksum = await sha256Hex(rawBackup);
    const { data: verified, error: verifyError } = await supabase.rpc(
      "verify_backup_run_v1",
      {
        p_run_id: backupData.backup_run_id,
        p_checksum_sha256: checksum,
      },
    );
    if (verifyError || !verified) {
      return NextResponse.json(
        { error: "Yedek bütünlük doğrulaması başarısız oldu; dosya değiştirilmiş olabilir." },
        { status: 409 },
      );
    }
    integrityVerified = true;
  }

  try {
    const { data, error } = await supabase.rpc("restore_backup_v2", {
      p_backup: backupData as unknown as Json,
    });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Yedek tek transaction içinde başarıyla geri yüklendi.",
      integrity_verified: integrityVerified,
      result: data,
    });
  } catch (error: unknown) {
    const requestId = requestIdFrom(req);
    const errorCode = errorCodeFrom(error);
    structuredLog("error", "backup.restore.failed", {
      requestId,
      operation: "backup.restore",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "backup.restore.failed",
      severity: "critical",
      source: "restore",
      requestId,
      route: "/api/backup",
      errorCode,
    });
    return NextResponse.json(
      { error: "Geri yükleme başarısız oldu; transaction tamamen geri alındı." },
      { status: 500 },
    );
  }
}

export const GET = observedRoute("backup.export", exportBackup);
export const POST = observedRoute("backup.restore", restoreBackup);
