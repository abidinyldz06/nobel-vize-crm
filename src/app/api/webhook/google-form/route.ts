import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/webhook/google-form
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    const { 
      firstName, 
      lastName, 
      phone, 
      email, 
      country,
      passportNo,
      passportExpiry,
      passportIssuingCountry,
      visaType = 'turist',
      assignedStaffId,
      consulateFee,
      serviceFee,
      consultantNote
    } = data;

    if (!firstName || !lastName || !phone) {
      return NextResponse.json({ success: false, message: 'İsim, soyisim ve telefon zorunludur' }, { status: 400 });
    }

    // Bypass RLS in webhook by using SERVICE_ROLE_KEY if available, else fallback to ANON_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 1. Duplicate Kontrolü
    let customerId = null;
    let isDuplicateCustomer = false;

    // Telefon veya email ile mevcut müşteriyi ara
    let query = supabase.from('customers').select('id').eq('phone', phone);
    if (email) {
      query = supabase.from('customers').select('id').or(`phone.eq.${phone},email.eq.${email}`);
    }

    const { data: existingCustomers, error: searchError } = await query.limit(1);

    if (searchError) throw searchError;

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      isDuplicateCustomer = true;
    } else {
      // Yeni Müşteri Oluştur
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([{ 
          first_name: firstName, 
          last_name: lastName, 
          phone, 
          email,
          passport_no: passportNo,
          passport_expiry: passportExpiry,
          passport_issuing_country: passportIssuingCountry
        }])
        .select('id')
        .single();

      if (createError) throw createError;
      customerId = newCustomer.id;
    }

    if (!customerId) throw new Error("Müşteri ID alınamadı");

    // 2. Ülke Bilgisi ve Application Kontrolü
    if (country) {
      const { data: countryData } = await supabase.from('countries').select('*').ilike('name', country).single();
      
      if (!countryData) {
        return NextResponse.json({ success: false, message: `Sistemde ${country} ülkesi bulunamadı.` }, { status: 400 });
      }

      if (isDuplicateCustomer) {
        // Bu müşterinin bu ülkeye zaten başvurusu var mı?
        const { data: existingApps } = await supabase
          .from('applications')
          .select('id')
          .eq('customer_id', customerId)
          .ilike('country', country);

        if (existingApps && existingApps.length > 0) {
          return NextResponse.json({ success: false, message: "Bu müşteri zaten bu ülkeye başvuru yapmış", customerId }, { status: 409 });
        }
      }

      // 3. Danışman Ataması
      let staffId = assignedStaffId;
      if (!staffId) {
        // En az ataması olan aktif personeli bul
        const { data: staffList } = await supabase
          .from('staff')
          .select('id, customers(count)')
          .eq('is_active', true);

        if (staffList && staffList.length > 0) {
          const sorted = staffList.sort((a: any, b: any) => {
             const aCount = a.customers?.[0]?.count || 0;
             const bCount = b.customers?.[0]?.count || 0;
             return aCount - bCount;
          });
          staffId = sorted[0].id;
        }
      }

      // Müşterinin assigned_staff_id'sini güncelle (eğer boşsa veya yeni atandıysa)
      await supabase.from('customers').update({ assigned_staff_id: staffId }).eq('id', customerId).is('assigned_staff_id', null);

      // 4. Ücret Hesaplama
      let finalFee = countryData.base_fee;
      let cFee = consulateFee ? Number(consulateFee) : null;
      let sFee = serviceFee ? Number(serviceFee) : null;
      
      if (cFee !== null || sFee !== null) {
        finalFee = (cFee || 0) + (sFee || 0);
      }

      // Başvuru Oluştur
      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert([{ 
           customer_id: customerId, 
           country: countryData.name,
           visa_type: visaType,
           total_fee: finalFee,
           consulate_fee: cFee,
           service_fee: sFee,
           assigned_staff_id: staffId
        }])
        .select('id')
        .single();

      if (appError) throw appError;

      // 5. Evrakları Oluştur
      const checklist: string[] = countryData.document_checklist || [];
      if (checklist.length > 0) {
        const docs = checklist.map((doc: string) => ({
          application_id: application.id,
          document_type: doc,
          status: 'bekleniyor'
        }));
        await supabase.from('documents').insert(docs);
      }

      // 6. Not Ekle
      if (consultantNote) {
        await supabase.from('notes').insert([{
          application_id: application.id,
          content: consultantNote,
          created_by: staffId
        }]);
      }

      // 7. Activity Log Ekle
      await supabase.from('activity_log').insert([{
        customer_id: customerId,
        application_id: application.id,
        action: "Google Form'dan otomatik oluşturuldu",
        performed_by: staffId
      }]);
    }

    if (isDuplicateCustomer) {
      return NextResponse.json({ success: true, message: "Mevcut müşteriye yeni başvuru eklendi", customerId }, { status: 201 });
    }

    return NextResponse.json({ success: true, message: "Müşteri ve dosya başarıyla oluşturuldu", customerId }, { status: 201 });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Sunucu hatası oluştu' }, { status: 500 });
  }
}
