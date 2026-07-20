import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";

// Kaydedilecek ve geri yüklenecek tabloların doğru sırası (Parent -> Child)
const TABLES_ORDER = [
  "countries",
  "country_visa_requirements",
  "customers",
  "applications",
  "documents",
  "payments",
  "notes",
  "communications",
  "visa_history",
  "family_members",
  "activity_log"
];

// Silme işlemi için ters sıra (Child -> Parent)
const TABLES_REVERSE_ORDER = [...TABLES_ORDER].reverse();

export async function GET() {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const exportData: Record<string, any> = {
    exportDate: new Date().toISOString(),
    version: "1.0",
    tables: {}
  };

  try {
    for (const table of TABLES_ORDER) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.error(`Error exporting table ${table}:`, error);
        throw new Error(`Failed to export ${table}: ${error.message}`);
      }
      exportData.tables[table] = data || [];
    }

    // Response header'larını ayarlayarak dosya indirmesini sağla
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="nobel-vize-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  // Mevcut restore akışı transaction kullanmadığı için varsayılan olarak kapalıdır.
  // Faz 1'de atomik veritabanı fonksiyonuna taşınana kadar yalnızca kontrollü
  // bakım penceresinde iki ayrı onayla açılabilir.
  if (process.env.ENABLE_DANGEROUS_RESTORE !== "true") {
    return NextResponse.json(
      { error: "Geri yükleme güvenlik nedeniyle devre dışı. Atomik restore Faz 1 kapsamında tamamlanacak." },
      { status: 503 },
    );
  }

  if (req.headers.get("x-confirm-restore") !== "RESTORE_ALL_DATA") {
    return NextResponse.json({ error: "Geri yükleme onay başlığı eksik." }, { status: 400 });
  }

  try {
    const backupData = await req.json();

    if (!backupData || !backupData.tables) {
      return NextResponse.json({ error: "Invalid backup file format." }, { status: 400 });
    }

    // 1. Önce Foreign Key hatalarını engellemek için Child'dan Parent'a doğru tüm verileri sil.
    for (const table of TABLES_REVERSE_ORDER) {
      // not('id', 'is', null) tüm kayıtları eşleştirip siler
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error) {
        console.error(`Error deleting table ${table}:`, error);
        throw new Error(`Failed to clear table ${table}: ${error.message}`);
      }
    }

    // 2. Parent'dan Child'a doğru verileri insert et.
    for (const table of TABLES_ORDER) {
      const records = backupData.tables[table];
      if (records && records.length > 0) {
        // Toplu insert işlemi (Eğer kayıt sayısı çok fazlaysa batch halinde yapılmalıdır, ama şimdilik doğrudan insert ediyoruz)
        const { error } = await supabase.from(table).insert(records);
        if (error) {
          console.error(`Error restoring table ${table}:`, error);
          throw new Error(`Failed to restore table ${table}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Backup successfully restored." });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
