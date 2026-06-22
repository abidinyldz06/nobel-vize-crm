import { createClient } from '@supabase/supabase-js';

const url = 'https://zrxdwnshegihakqfszfh.supabase.co';
const key = 'sb_publishable_p6BmdDFqPT3NYOvhBX5bXg_vV4Oc4og';

const supabase = createClient(url, key);

async function seedCountries() {
  const { data, error } = await supabase.from('countries').select('*');
  
  if (data && data.length === 0) {
    console.log("Seeding countries...");
    const countries = [
      { 
        name: 'Fransa', 
        visa_system: 'Schengen (VFS/iDATA)', 
        base_fee: 130, 
        document_checklist: ["Pasaport (İlk Sayfa)", "Biyometrik Fotoğraf (2 Adet)", "Son 3 Aylık Banka Dökümü", "SGK İşe Giriş Bildirgesi", "Maaş Bordrosu (Son 3 Ay)", "İşveren Yazısı", "Otel Rezervasyonu", "Uçak Bileti"]
      },
      { 
        name: 'İngiltere', 
        visa_system: 'UK Online', 
        base_fee: 150, 
        document_checklist: ["Pasaport", "Biyometrik Fotoğraf", "Vukuatlı Nüfus Kayıt Örneği", "Banka Hesap Dökümü", "İngilizce İşveren Yazısı", "Online Başvuru Formu"]
      },
      { 
        name: 'ABD', 
        visa_system: 'US DS-160', 
        base_fee: 185, 
        document_checklist: ["Pasaport", "DS-160 Formu", "Biyometrik Fotoğraf (5x5)", "Banka Hesap Dökümü"]
      }
    ];

    const { error: insertError } = await supabase.from('countries').insert(countries);
    if (insertError) {
      console.error("Insert error:", insertError.message);
    } else {
      console.log("Countries seeded successfully!");
    }
  } else {
    console.log("Countries already exist.");
  }
}

seedCountries();
