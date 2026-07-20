import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { verifySignedWebhook } from '@/lib/webhook-security';

interface GoogleFormWebhookPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  country?: string;
  passportNo?: string;
  passportExpiry?: string;
  passportIssuingCountry?: string;
  visaType?: string;
  assignedStaffId?: string;
  consulateFee?: number | string;
  serviceFee?: number | string;
  consultantNote?: string;
}

interface StaffLoadRow {
  id: string;
  customers?: Array<{ count?: number }>;
}

// POST /api/webhook/google-form
export async function POST(request: Request) {
  let webhookEventId: string | null = null;
  try {
    const verification = await verifySignedWebhook(request);
    if (!verification.ok) {
      return NextResponse.json(
        { success: false, message: verification.error },
        { status: verification.status },
      );
    }

    let data: GoogleFormWebhookPayload;
    try {
      data = JSON.parse(verification.rawBody) as GoogleFormWebhookPayload;
    } catch {
      return NextResponse.json({ success: false, message: 'Geçersiz JSON gövdesi' }, { status: 400 });
    }
    
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

    if (typeof firstName !== 'string' || typeof lastName !== 'string' || typeof phone !== 'string' || !firstName.trim() || !lastName.trim() || !phone.trim()) {
      return NextResponse.json({ success: false, message: 'İsim, soyisim ve telefon zorunludur' }, { status: 400 });
    }

    if (firstName.length > 100 || lastName.length > 100 || phone.length > 30 || (typeof email === 'string' && email.length > 254)) {
      return NextResponse.json({ success: false, message: 'Gönderilen alanlardan biri izin verilen uzunluğu aşıyor' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    webhookEventId = verification.eventId;
    const { error: eventInsertError } = await supabase.from('webhook_events').insert({
      event_id: webhookEventId,
      source: 'google-form',
      status: 'processing',
    });

    if (eventInsertError?.code === '23505') {
      return NextResponse.json(
        { success: false, message: 'Bu webhook olayı daha önce işlendi.' },
        { status: 409 },
      );
    }
    if (eventInsertError) throw eventInsertError;

    // 1. Duplicate Kontrolü
    let customerId = null;
    let isDuplicateCustomer = false;

    // Telefon veya email ile mevcut müşteriyi ara
    const normalizedPhone = phone.trim();
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    let { data: existingCustomers, error: searchError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (!searchError && (!existingCustomers || existingCustomers.length === 0) && normalizedEmail) {
      const emailResult = await supabase.from('customers').select('id').eq('email', normalizedEmail).limit(1);
      existingCustomers = emailResult.data;
      searchError = emailResult.error;
    }

    if (searchError) throw searchError;

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      isDuplicateCustomer = true;
    } else {
      // Yeni Müşteri Oluştur
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert([{ 
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: normalizedPhone,
          email: normalizedEmail,
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
        await supabase.from('webhook_events').update({ status: 'rejected' }).eq('event_id', webhookEventId);
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
          await supabase.from('webhook_events').update({ status: 'rejected' }).eq('event_id', webhookEventId);
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
          const sorted = (staffList as StaffLoadRow[]).sort((a, b) => {
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
      const cFee = consulateFee ? Number(consulateFee) : null;
      const sFee = serviceFee ? Number(serviceFee) : null;
      
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
      await supabase.from('webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', webhookEventId);
      return NextResponse.json({ success: true, message: "Mevcut müşteriye yeni başvuru eklendi", customerId }, { status: 201 });
    }

    await supabase.from('webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', webhookEventId);
    return NextResponse.json({ success: true, message: "Müşteri ve dosya başarıyla oluşturuldu", customerId }, { status: 201 });

  } catch (error: unknown) {
    console.error('Webhook Error:', error);
    if (webhookEventId) {
      try {
        await createSupabaseAdminClient()
          .from('webhook_events')
          .update({ status: 'failed' })
          .eq('event_id', webhookEventId);
      } catch (eventError) {
        console.error('Webhook event status update failed:', eventError);
      }
    }
    return NextResponse.json({ success: false, message: 'Sunucu hatası oluştu' }, { status: 500 });
  }
}
