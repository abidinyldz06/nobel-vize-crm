import { NextResponse } from 'next/server';
import {
  CustomerWorkflowError,
  runCustomerApplicationWorkflow,
} from '@/lib/customer-workflow';
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

function parseOptionalMoney(value: number | string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('invalid_fee');
  }
  return parsed;
}

function workflowHttpStatus(error: CustomerWorkflowError): number {
  if (error.message.includes('duplicate_customer_application')) return 409;
  if (error.message.includes('country_not_found_or_inactive')) return 400;
  if (error.code === '22001' || error.code === '22023' || error.code === '23503') return 400;
  return 500;
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
      visaType = 'turistik',
      assignedStaffId,
      consultantNote,
    } = data;

    if (typeof firstName !== 'string'
      || typeof lastName !== 'string'
      || typeof phone !== 'string'
      || !firstName.trim()
      || !lastName.trim()
      || !phone.trim()) {
      return NextResponse.json(
        { success: false, message: 'İsim, soyisim ve telefon zorunludur' },
        { status: 400 },
      );
    }

    if (firstName.length > 100
      || lastName.length > 100
      || phone.length > 30
      || (typeof email === 'string' && email.length > 254)
      || (typeof country === 'string' && country.length > 120)) {
      return NextResponse.json(
        { success: false, message: 'Gönderilen alanlardan biri izin verilen uzunluğu aşıyor' },
        { status: 400 },
      );
    }

    let consulateFee: number | null;
    let serviceFee: number | null;
    try {
      consulateFee = parseOptionalMoney(data.consulateFee);
      serviceFee = parseOptionalMoney(data.serviceFee);
    } catch {
      return NextResponse.json({ success: false, message: 'Ücret alanları geçersiz' }, { status: 400 });
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

    const normalizedPhone = phone.trim();
    const normalizedEmail = typeof email === 'string' && email.trim()
      ? email.trim().toLowerCase()
      : null;

    let { data: existingCustomers, error: searchError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1);

    if (!searchError && (!existingCustomers || existingCustomers.length === 0) && normalizedEmail) {
      const emailResult = await supabase
        .from('customers')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1);
      existingCustomers = emailResult.data;
      searchError = emailResult.error;
    }
    if (searchError) throw searchError;

    const existingCustomerId = existingCustomers?.[0]?.id ?? null;
    const result = await runCustomerApplicationWorkflow(supabase, {
      customer_id: existingCustomerId || undefined,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      profile_score: 30,
      passport_no: passportNo?.trim() || null,
      passport_expiry: passportExpiry || null,
      passport_issuing_country: passportIssuingCountry?.trim() || 'Türkiye',
      country_name: country?.trim() || null,
      visa_type: visaType,
      assigned_staff_id: assignedStaffId || null,
      consulate_fee: consulateFee,
      service_fee: serviceFee,
      consultant_note: consultantNote?.trim() || null,
      activity_action: "Google Form'dan atomik iş akışıyla oluşturuldu",
      reject_duplicate_application: existingCustomerId !== null,
    });

    const { error: processedError } = await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_id', webhookEventId);
    if (processedError) throw processedError;

    return NextResponse.json({
      success: true,
      message: result.existing_customer
        ? 'Mevcut müşteriye yeni başvuru eklendi'
        : 'Müşteri ve dosya başarıyla oluşturuldu',
      customerId: result.customer_id,
      applicationId: result.application_id,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Webhook Error:', error);

    const responseStatus = error instanceof CustomerWorkflowError
      ? workflowHttpStatus(error)
      : 500;
    const eventStatus = responseStatus < 500 ? 'rejected' : 'failed';

    if (webhookEventId) {
      try {
        await createSupabaseAdminClient()
          .from('webhook_events')
          .update({ status: eventStatus })
          .eq('event_id', webhookEventId);
      } catch (eventError) {
        console.error('Webhook event status update failed:', eventError);
      }
    }

    const message = responseStatus === 409
      ? 'Bu müşteri için aynı ülke ve vize türünde bir başvuru zaten var.'
      : responseStatus === 400
        ? 'Gönderilen ülke, personel veya başvuru bilgisi geçersiz.'
        : 'Sunucu hatası oluştu';
    return NextResponse.json({ success: false, message }, { status: responseStatus });
  }
}
