import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/webhook/google-form
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Beklenen format (Google Apps Script'ten JSON olarak gönderilecek):
    // { "firstName": "Ayşe", "lastName": "Demir", "phone": "05321112233", "email": "ayse@email.com", "country": "Fransa" }
    
    const { firstName, lastName, phone, email, country } = data;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'İsim ve soyisim zorunludur' }, { status: 400 });
    }

    // 1. Müşteriyi Oluştur
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert([{ first_name: firstName, last_name: lastName, phone, email }])
      .select()
      .single();

    if (customerError) throw customerError;

    // 2. Ülkeyi Bul ve Başvuru Oluştur
    if (country) {
      const { data: countryData } = await supabase.from('countries').select('*').ilike('name', country).single();
      
      if (countryData) {
        const { data: application, error: appError } = await supabase
          .from('applications')
          .insert([{ 
             customer_id: customer.id, 
             country: countryData.name,
             total_fee: countryData.base_fee
          }])
          .select()
          .single();

        if (appError) throw appError;

        // 3. Evrakları Oluştur
        const checklist: string[] = countryData.document_checklist || [];
        if (checklist.length > 0) {
          const docs = checklist.map((doc: string) => ({
            application_id: application.id,
            document_type: doc,
            status: 'bekleniyor'
          }));
          await supabase.from('documents').insert(docs);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Müşteri ve dosya başarıyla oluşturuldu.", customerId: customer.id }, { status: 201 });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Bilinmeyen Hata' }, { status: 500 });
  }
}
