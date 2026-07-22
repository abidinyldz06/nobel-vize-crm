import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/types/database";

const TABLES_ORDER = [
  "tenants",
  "staff",
  "countries",
  "country_visa_rules",
  "customers",
  "applications",
  "documents",
  "notes",
  "payments",
  "activity_log",
  "communications",
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
  countries: "id",
  country_visa_rules: "id",
  customers: "id",
  applications: "id",
  documents: "id",
  notes: "id",
  payments: "id",
  activity_log: "id",
  communications: "id",
  tasks: "id",
  notifications: "id",
  visa_history: "id",
  family_members: "id",
  webhook_events: "event_id",
};

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const PAGE_SIZE = 1000;

interface BackupV2 {
  format: "nobel-vize-crm-backup";
  version: "2.0";
  exported_at: string;
  schema: "phase1";
  storage: {
    included: false;
    note: string;
  };
  tables: Record<BackupTable, unknown[]>;
}

function isBackupV2(value: unknown): value is BackupV2 {
  if (!value || typeof value !== "object") return false;
  const backup = value as Record<string, unknown>;
  if (backup.format !== "nobel-vize-crm-backup" || backup.version !== "2.0") return false;
  if (!backup.tables || typeof backup.tables !== "object" || Array.isArray(backup.tables)) return false;
  const tables = backup.tables as Record<string, unknown>;
  return TABLES_ORDER.every(table => Array.isArray(tables[table]));
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

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  try {
    const tableEntries = await Promise.all(
      TABLES_ORDER.map(async table => [table, await exportTable(table)] as const),
    );

    const backup: BackupV2 = {
      format: "nobel-vize-crm-backup",
      version: "2.0",
      exported_at: new Date().toISOString(),
      schema: "phase1",
      storage: {
        included: false,
        note: "Belge metadata kayitlari dahildir; storage dosya binary'leri ayri yedeklenmelidir.",
      },
      tables: Object.fromEntries(tableEntries) as Record<BackupTable, unknown[]>,
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="nobel-vize-backup-v2-${new Date().toISOString().split("T")[0]}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Backup export failed:", error);
    return NextResponse.json({ error: "Yedek oluşturulamadı." }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

  try {
    const { data, error } = await supabase.rpc("restore_backup_v2", {
      p_backup: backupData as unknown as Json,
    });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Yedek tek transaction içinde başarıyla geri yüklendi.",
      result: data,
    });
  } catch (error: unknown) {
    console.error("Atomic restore failed:", error);
    return NextResponse.json(
      { error: "Geri yükleme başarısız oldu; transaction tamamen geri alındı." },
      { status: 500 },
    );
  }
}
