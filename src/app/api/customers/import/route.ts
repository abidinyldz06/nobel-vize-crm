import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: staffRecord } = await supabase.from('staff').select('id, role').eq('user_id', user.id).single();
  const staffId = staffRecord?.id;

  const body = await req.json();
  const { rows, resolutionMode } = body;
  
  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
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

  for (const row of rows) {
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
        const customerData: any = {
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone || null,
          email: row.email || null,
          profile_score: 30,
          passport_no: row.passport_no || null,
        };
        if (staffId) customerData.assigned_staff_id = staffId;

        const { data: newCustomer, error: insertErr } = await supabase
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        if (insertErr) throw new Error(`Müşteri eklenemedi: ${row.first_name} ${row.last_name}`);
        const customerId = newCustomer.id;

        // If a country was provided, try to match it
        let resolvedCountry = null;
        let checklist: any[] = [];
        let baseFee = 0;

        if (row.country) {
          const rowCountryLower = String(row.country).toLowerCase().trim();
          resolvedCountry = countries?.find(c => c.name.toLowerCase() === rowCountryLower);
          if (resolvedCountry) {
            baseFee = resolvedCountry.base_fee_service || 0;
            const req = reqs?.find(r => r.country_id === resolvedCountry.id);
            if (req && req.documents) {
              checklist = req.documents;
            }
          }
        }

        if (resolvedCountry) {
          // Create Application
          const appData: any = {
            customer_id: customerId,
            country: resolvedCountry.name,
            consulate_fee: 0,
            service_fee: baseFee,
            total_fee: baseFee,
            status: 'profil_analizi',
            visa_type: 'turist',
          };
          if (staffId) appData.assigned_staff_id = staffId;

          const { data: application, error: appErr } = await supabase
            .from('applications')
            .insert([appData])
            .select()
            .single();

          if (!appErr && checklist.length > 0) {
            const docs = checklist.map((doc: any) => ({
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
    } catch (err: any) {
      results.failed++;
      results.errors.push(err.message);
    }
  }

  return NextResponse.json(results);
}
