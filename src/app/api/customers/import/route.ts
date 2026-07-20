import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";

interface ImportRow {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  passport_no?: string;
  country?: string;
}

interface CountryRow {
  id: string;
  name: string;
  base_fee_service?: number | null;
}

interface DocumentRule {
  name: string;
  category?: string;
  required?: boolean;
  description?: string;
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
  
  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const importRows = rows as ImportRow[];
  if (!importRows.every(row => row && typeof row.first_name === "string" && typeof row.last_name === "string")) {
    return NextResponse.json({ error: "Her satırda ad ve soyad bulunmalıdır." }, { status: 400 });
  }

  if (resolutionMode !== "skip" && resolutionMode !== "update") {
    return NextResponse.json({ error: "Geçersiz mükerrer kayıt çözüm modu." }, { status: 400 });
  }

  // Fetch reference data
  const { data: countries } = await supabase.from('countries').select('*');
  const { data: reqs } = await supabase.from('country_visa_requirements').select('*').eq('visa_type', 'turist');

  // Fetch existing customers to handle duplicates
  const { data: existingCustomers } = await supabase.from('customers').select('id, phone, email');
  
  const results = {
    success: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const row of importRows) {
    try {
      // Find duplicate (phone can have different formats, but for basic import we match exact or after trimming)
      const cleanPhone = row.phone ? row.phone.replace(/[^0-9]/g, '') : null;
      
      const duplicate = existingCustomers?.find(c => {
        const cPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : null;
        return (cleanPhone && cPhone === cleanPhone) || (row.email && c.email === row.email);
      });

      if (duplicate) {
        if (resolutionMode === 'skip') {
          results.skipped++;
          continue;
        } else if (resolutionMode === 'update') {
          // Update profile only
          const { error: updateErr } = await supabase.from('customers').update({
            first_name: row.first_name,
            last_name: row.last_name,
            passport_no: row.passport_no || null,
          }).eq('id', duplicate.id);
          
          if (updateErr) throw new Error(`Müşteri güncellenemedi: ${row.first_name} ${row.last_name}`);
          results.updated++;
          continue; 
        }
      } else {
        // Create new customer
        const customerData = {
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone || null,
          email: row.email || null,
          profile_score: 30,
          passport_no: row.passport_no || null,
        };
        const { data: newCustomer, error: insertErr } = await supabase
          .from('customers')
          .insert({ ...customerData, assigned_staff_id: staffId })
          .select()
          .single();

        if (insertErr) throw new Error(`Müşteri eklenemedi: ${row.first_name} ${row.last_name}`);
        const customerId = newCustomer.id;

        // If a country was provided, try to match it
        let resolvedCountry: CountryRow | null = null;
        let checklist: DocumentRule[] = [];
        let baseFee = 0;

        if (row.country) {
          const rowCountryLower = String(row.country).toLowerCase().trim();
          resolvedCountry = (countries as CountryRow[] | null)?.find(c => c.name.toLowerCase() === rowCountryLower) || null;
          if (resolvedCountry) {
            baseFee = resolvedCountry.base_fee_service || 0;
            const resolvedCountryId = resolvedCountry.id;
            const req = reqs?.find(r => r.country_id === resolvedCountryId);
            if (req && req.documents) {
              checklist = req.documents as DocumentRule[];
            }
          }
        }

        if (resolvedCountry) {
          // Create Application
          const appData = {
            customer_id: customerId,
            country: resolvedCountry.name,
            consulate_fee: 0,
            service_fee: baseFee,
            total_fee: baseFee,
            status: 'profil_analizi',
            visa_type: 'turist',
          };
          const { data: application, error: appErr } = await supabase
            .from('applications')
            .insert([{ ...appData, assigned_staff_id: staffId }])
            .select()
            .single();

          if (!appErr && checklist.length > 0) {
            const docs = checklist.map(doc => ({
              application_id: application.id,
              document_type: doc.name,
              category: doc.category || 'diger',
              is_required: doc.required !== undefined ? doc.required : true,
              description: doc.description || null,
              status: 'bekleniyor'
            }));
            await supabase.from('documents').insert(docs);
          }
        }
        
        results.success++;
      }
    } catch (err: unknown) {
      results.failed++;
      results.errors.push(err instanceof Error ? err.message : "Bilinmeyen içe aktarma hatası");
    }
  }

  return NextResponse.json(results);
}
