import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { runCustomerApplicationWorkflow } from "@/lib/customer-workflow";

interface ImportRow {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  passport_no?: string;
  country?: string;
}

interface ExistingCustomer {
  id: string;
  phone: string | null;
  email: string | null;
}

export async function POST(req: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { supabase, staff } = context;
  const staffId = staff.id;

  let body: { rows?: unknown; resolutionMode?: unknown };
  try {
    body = await req.json() as { rows?: unknown; resolutionMode?: unknown };
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  const { rows, resolutionMode } = body;
  
  if (!rows || !Array.isArray(rows) || rows.length === 0 || rows.length > 1000) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const importRows = rows as ImportRow[];
  if (!importRows.every(row => row
    && typeof row.first_name === "string"
    && typeof row.last_name === "string"
    && row.first_name.trim().length > 0
    && row.last_name.trim().length > 0
    && row.first_name.length <= 100
    && row.last_name.length <= 100
    && (!row.email || row.email.length <= 254)
    && (!row.phone || row.phone.length <= 30))) {
    return NextResponse.json({ error: "Her satırda ad ve soyad bulunmalıdır." }, { status: 400 });
  }

  if (resolutionMode !== "skip" && resolutionMode !== "update") {
    return NextResponse.json({ error: "Geçersiz mükerrer kayıt çözüm modu." }, { status: 400 });
  }

  // Fetch existing customers to handle duplicates
  const { data: existingCustomers, error: existingCustomersError } = await supabase
    .from('customers')
    .select('id, phone, email');
  if (existingCustomersError) {
    return NextResponse.json({ error: "Mevcut müşteri listesi alınamadı." }, { status: 500 });
  }
  const knownCustomers = (existingCustomers ?? []) as ExistingCustomer[];
  
  const results = {
    success: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const [rowIndex, row] of importRows.entries()) {
    try {
      // Find duplicate (phone can have different formats, but for basic import we match exact or after trimming)
      const cleanPhone = row.phone ? row.phone.replace(/[^0-9]/g, '') : null;
      
      const normalizedEmail = row.email?.trim().toLowerCase() || null;
      const duplicate = knownCustomers.find(c => {
        const cPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : null;
        return (cleanPhone && cPhone === cleanPhone)
          || (normalizedEmail && c.email?.toLowerCase() === normalizedEmail);
      });

      if (duplicate) {
        if (resolutionMode === 'skip') {
          results.skipped++;
          continue;
        } else if (resolutionMode === 'update') {
          // Update profile only
          const { error: updateErr } = await supabase.from('customers').update({
            first_name: row.first_name.trim(),
            last_name: row.last_name.trim(),
            passport_no: row.passport_no || null,
          }).eq('id', duplicate.id);
          
          if (updateErr) throw new Error(`Müşteri güncellenemedi: ${row.first_name} ${row.last_name}`);
          results.updated++;
          continue; 
        }
      } else {
        const result = await runCustomerApplicationWorkflow(supabase, {
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          phone: row.phone?.trim() || null,
          email: normalizedEmail,
          profile_score: 30,
          passport_no: row.passport_no || null,
          country_name: row.country?.trim() || null,
          visa_type: 'turistik',
          assigned_staff_id: staffId,
          consulate_fee: 0,
          activity_action: 'CSV içe aktarma ile müşteri kaydı oluşturuldu',
        });

        knownCustomers.push({
          id: result.customer_id,
          phone: row.phone?.trim() || null,
          email: normalizedEmail,
        });
        results.success++;
      }
    } catch (err: unknown) {
      results.failed++;
      const message = err instanceof Error ? err.message : "Bilinmeyen içe aktarma hatası";
      results.errors.push(`Satır ${rowIndex + 1}: ${message}`);
    }
  }

  return NextResponse.json(results);
}
