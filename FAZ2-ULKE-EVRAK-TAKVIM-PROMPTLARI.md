# Nobel Vize CRM — FAZ 2: ÜLKE/EVRAK SİSTEMİ + VİZE TÜRLERİ + TAKVİM
**Tarih:** 22 Haziran 2026
**Proje:** ~/Desktop/nobel-vize-crm/ (Next.js 16 + Supabase)

---

## MEVCUT DURUM ANALİZİ

### Ülke & Evrak Sistemi (SORUNLU)
- 20 ülke var ama hepsine AYNI evrak listesi atanıyor
- `document_checklist` tek bir JSON array — vize türüne göre ayrışmıyor
- "Almanya turistik" ile "Almanya aile ziyareti" aynı evrakları gösteriyor
- Danışman kendi evrak ekleyebiliyor ama bu yeterli değil
- Ülke yapısı: `name, visa_system, base_fee, document_checklist` — vize türü yok

### Vize Türleri (EKSİK)
- Mevcut: turist, iş, öğrenci, aile, transit, tedavi
- EKSIK: "Aile Ziyareti" (aile birleşimi değil!), "Çift/iş amaçlı", "Kültürel/Spor", "Araştırma"
- "Aile" → "Aile Birleşimi" olarak yazıyor ama "Aile Ziyareti" ayrı bir kategori olmalı

### Randevu Takvimi (YETERSİZ)
- Sadece "Yaklaşan Randevular" ve "Geçmiş Randevular" listesi
- Gerçek takvim görünümü yok (aylık/griglia)
- Dashboard'da zaten var, ayrı sayfada da aynı şey var — gereksiz

---

## PROMPT 1: ÜLKE + VİZE TÜRÜ + EVRAK MATRİSİ SİSTEMİ

```
Nobel Vize CRM'de ülke/evrak sistemini tamamen yeniden tasarla. Mevcut sistemde tüm ülkelere aynı evrak listesi atanıyor — bu yanlış. Her ülke + vize türü kombinasyonu için AYRI evrak listesi olmalı.

### 1. YENİ VERİ MODELİ

#### countries tablosunu güncelle:
MEVCUT:
- name, visa_system, base_fee, document_checklist (JSONB)

YENİ:
- name (TEXT) — "Fransa", "Almanya", "İngiltere", "ABD"
- visa_system (TEXT) — "Schengen (VFS/iDATA)", "UK Online", "US DS-160", "Kanada Online"
- appointment_system (TEXT) — "VFS", "iDATA", "Konsolosluk", "Online"
- base_fee_visa (DECIMAL) — sadece konsolosluk vize harcı (örn: Fransa 80 EUR)
- base_fee_service (DECIMAL) — ofis hizmet bedeli (örn: 2500 TL)
- active (BOOLEAN)
- notes (TEXT)

#### YENİ TABLO: country_visa_requirements
Her ülke + vize türü kombinasyonu için ayrı evrak listesi:

```sql
CREATE TABLE country_visa_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
  visa_type TEXT NOT NULL, -- 'turistik', 'aile_ziyareti', 'is', 'ogrenci', 'transit', 'tedavi', 'arastirma', 'kulturel_spor'
  documents JSONB NOT NULL, -- [{name: "Pasaport", required: true, category: "temel"}, {name: "Banka Dökümü", required: true, category: "finansal"}, ...]
  processing_time TEXT, -- "10-15 iş günü", "3-5 iş günü"
  validity TEXT, -- "90 gün", "6 ay", "1 yıl"
  max_stay TEXT, -- "90 gün", "180 gün"
  multiple_entry BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country_id, visa_type)
);
```

documents JSONB yapısı:
```json
[
  {"name": "Pasaport", "required": true, "category": "temel", "description": "Son 10 yıl içinde çıkarılmış, seyahatten sonra en az 3 ay geçerli, 2 boş sayfa"},
  {"name": "Biyometrik Fotoğraf", "required": true, "category": "temel", "description": "35x47mm, son 3 ay, beyaz fon"},
  {"name": "Banka Hesap Dökümü", "required": true, "category": "finansal", "description": "Son 3 ay, ıslak imza/muhasebe onaylı"},
  {"name": "İşveren Yazısı", "required": true, "category": "mesleki", "description": "Şirket antetli, izin tarihleri belirtilmiş"},
  {"name": "Otel Rezervasyonu", "required": true, "category": "seyahat", "description": "Tüm günler için konaklama"},
  {"name": "Uçak Bileti Rezervasyonu", "required": true, "category": "seyahat", "description": "Gidiş-dönüş rezervasyonu"},
  {"name": "Seyahat Sağlık Sigortası", "required": true, "category": "sigorta", "description": "Min 30.000 EUR teminatlı, Schengen geçerli"},
  {"name": "SGK Hizmet Dökümü", "required": true, "category": "mesleki", "description": "Son 6 ay"},
  {"name": "Maaş Bordrosu", "required": true, "category": "finansal", "description": "Son 3 ay"},
  {"name": "Tapu/Ruhsat", "required": false, "category": "varlik", "description": "Varsa mal varlığı desteği"},
  {"name": "Vukuatlı Nüfus Kayıt Örneği", "required": false, "category": "kimlik", "description": "Tam vukuatlı"},
  {"name": "Eski Pasaportlar", "required": false, "category": "temel", "description": "Varsa tüm eski pasaportlar"},
  {"name": "Evlilik Cüzdanı", "required": false, "category": "kimlik", "description": "Evliyse"},
  {"name": "Çocuk Doğum Belgesi", "required": false, "category": "kimlik", "description": "Çocuk varsa + vekaletname"}
]
```

### 2. VİZE TÜRLERİ (GÜNCELLENMİŞ)

src/lib/visa-types.ts dosyasını güncelle:

```typescript
export const VISA_TYPE_LABELS: Record<string, string> = {
  turistik: "🏖️ Turistik",
  aile_ziyareti: "👨‍👩‍👧 Aile Ziyareti",
  aile_birlesimi: "🏠 Aile Birleşimi",
  is: "💼 İş",
  ogrenci: "🎓 Öğrenci",
  transit: "✈️ Transit",
  tedavi: "🏥 Tedavi",
  arastirma: "🔬 Araştırma",
  kulturel_spor: "🎭 Kültürel/Spor",
  calisma: "💼 Çalışma",
};
```

NOT: "aile" → "aile_ziyareti" ve "aile_birlesimi" olarak ikiye ayrıldı.

### 3. ÜLKE & EVRAK SAYFASI YENİDEN TASARLA

DOSYA: src/components/CountriesManager.tsx ve src/app/(main)/countries/page.tsx

MEVCUT: Ülke seç → tek evrak listesi düzenle

YENİ AKIŞ:
1. Ülke listesi (sol panel) — tıkla seç
2. Seçili ülke için vize türleri (üst sekmeler veya sağ panel):
   - 🏖️ Turistik | 👨‍👩‍👧 Aile Ziyareti | 💼 İş | 🎓 Öğrenci | ✈️ Transit | 🏥 Tedavi
3. Her vize türü için:
   - Evrak listesi (kategorilere göre gruplu):
     - 📋 Temel Evraklar (Pasaport, Fotoğraf, Form)
     - 💰 Finansal Evraklar (Banka, Bordro, Varlık)
     - 💼 Mesleki Evraklar (İşveren yazısı, SGK, Ticari sicil)
     - ✈️ Seyahat Evrakları (Uçak, Otel, Sigorta)
     - 🆔 Kimlik Evrakları (Nüfus, Evlilik, İkametgah)
   - Her evrak için: ad, gerekli/opsiyonel, açıklama
   - "Evrak Ekle" butonu (manuel ekleme)
   - "Evrak Sil" butonu
   - İşlem süresi, geçerlilik, max kalış süresi
4. "Değişiklikleri Kaydet" butonu — country_visa_requirements tablosuna upsert

### 4. YENİ MÜŞTERİ FORMUNDA VİZE TÜRÜ GÜNCELLEMESİ

DOSYA: src/app/(main)/customers/new/page.tsx

Vize türü dropdown'ını güncelle — yeni türleri ekle:
- 🏖️ Turistik
- 👨‍👩‍👧 Aile Ziyareti (YENİ)
- 🏠 Aile Birleşimi
- 💼 İş
- 🎓 Öğrenci
- ✈️ Transit
- 🏥 Tedavi
- 🔬 Araştırma (YENİ)
- 🎭 Kültürel/Spor (YENİ)

Ülke + vize türü seçilince:
1. country_visa_requirements tablosundan o kombinasyonun evrak listesini çek
2. Otomatik olarak documents tablosuna bu evrakları kaydet (müşteri başvurusuna)
3. Eğer o ülke + vize türü için kayıt yoksa — uyarı göster: "Bu ülke+vize türü için evrak listesi tanımlanmamış. Lütfen Ülke & Evraklar sayfasından tanımlayın."

### 5. SCHENGEN ÜLKELERİ İÇİN HAZIR EVRAK LİSTESİ (SEED DATA)

Schengen ülkeleri için ortak temel evraklar (Turistik):
- Pasaport, Biyometrik Fotoğraf, Vize Başvuru Formu, Kimlik Fotokopisi, İkametgah
- Uçak Bileti Rezervasyonu, Otel Rezervasyonu, Seyahat Sağlık Sigortası
- Banka Hesap Dökümü (son 3 ay), Maaş Bordrosu (son 3 ay), SGK Hizmet Dökümü (son 6 ay)
- İşveren Yazısı, Tapu/Ruhsat (opsiyonel), Eski Pasaportlar (opsiyonel)

Aile Ziyareti için ek:
- Davetiye (EU/Schengen vatandaşından)
- Davet edenin kimlik/pasaport kopyası
- Davet edenin ikametgah belgesi
- Evlilik/akrabalık belgesi (varsa)

İş için ek:
- Şirket antetli davet mektubu (yabancı şirketten)
- Ticari sicil gazetesi
- Vergi levhası
- Şirket imza sirküleri

Öğrenci için ek:
- Kabul mektubu (okuldan)
- Öğrenci belgesi
- Banka dekontu (eğitim ödemesi)
- Konaklama belgesi (yurt/kira)

İngiltere için:
- Online başvuru formu (gov.uk)
- İngilizce işveren yazısı
- TB testi sertifikası (varsa)
- PDF yükleme (fiziksel evrak YOK)

ABD için:
- DS-160 formu
- Fotoğraf 5x5cm (farklı boyut)
- Evrak yok, sadece form + görüşme

### 6. MÜŞTERİ DETAYINDA EVRAK LİSTESİ GÖRÜNÜMÜ

DOSYA: src/app/(main)/customers/[id]/page.tsx

Evrak listesi artık kategorilere göre gruplu gösterilsin:
- 📋 Temel Evraklar
- 💰 Finansal
- 💼 Mesleki
- ✈️ Seyahat
- 🆔 Kimlik
- 📦 Diğer (manuel eklenenler)

Her evrak kartında:
- Evrak adı
- Gerekli/Opsiyonel rozeti
- Açıklama (tooltip veya alt satır)
- Durum: Bekleniyor / Geldi / Kontrol Edildi / Yüklendi (PDF)
- Dosya yükle butonu (varsa)
- Durum değiştir butonu

ÖNEMLİ: Tüm UI Türkçe olmalı. Kategori isimleri emoji + Türkçe.
```

---

## PROMPT 2: RANDEVU TAKVİMİ — GERÇEK AYLIK TAKVİM

```
Nobel Vize CRM'de randevu takvimi sayfasını gerçek bir takvim görünümüne dönüştür.

DOSYA: src/app/(main)/appointments/page.tsx

MEVCUT: Basit liste — "Yaklaşan Randevular" + "Geçmiş Randevular" kartları. Bu zaten dashboard'da var, gereksiz duplicate.

YENİ TASARIM:

### 1. Aylık Takvim Görünümü
- Aylık grid takvim (Pzt-Paz kolonları)
- Her hücrede o günün randevuları gösterilsin
- Randevu olan günlerde nokta/rozet (dolular)
- Bugün highlight'lı
- Önceki/sonraki ay butonları
- Ay/yıl seçici

### 2. Takvim Hücreleri
Her gün kutusunda:
- 1-2 randevu varsa: müşteri adı (kısa) + saat
- 3+ randevu varsa: "+3 randevu" yaz, tıklayınca aç
- Boş gün: boş
- Bugün: mavi border
- Randevu geçti: gri renk

### 3. Günlük Görünüm (Sidebar veya Modal)
Bir güne tıklayınca:
- O günün tüm randevuları liste halinde
- Her randevu: saat, müşteri adı, ülke, lokasyon (Ankara/İstanbul), danışman
- "Yeni Randevu Ekle" butonu

### 4. Haftalık Görünüm (opsiyonel toggle)
- Hafta görünümü: 7 gün × saat dilimleri
- Daha detaylı, saat bazında

### 5. Üst Kısım
- Ay/Yıl navigasyon (← Haziran 2026 →)
- Görünüm toggle: [Aylık] [Haftalık] [Liste]
- "Bugün" butonu — bugüne git
- Renk kodu: mavi = yaklaşan, yeşil = bugün, gri = geçmiş, kırmızı = iptal

### 6. Teknoloji
- Hazır kütüphane kullanma (fullcalendar vs) — Tailwind + React ile basit grid yap
- Date fns veya native Date API kullan
- Mobil uyumlu: küçük ekranda tek kolon liste, büyük ekranda grid

ÖNEMLİ: Takvim verileri applications tablosundan gelsin (appointment_date, appointment_location, appointment_time alanları). Dashboard'daki "Yaklaşan Randevular" kartı kalsın ama /appointments sayfası artık gerçek takvim olsun.
```

---

## KULLANIM SIRASI

1. **Prompt 1** (Ülke/Evrak/Vize Türü) → ÖNCE BUNU YAP — en kritik
2. **Prompt 2** (Takvim) → Prompt 1 bitince yap

Her prompt tamamlandığında bana söyle, test edeyim.
```

---
*Hazırlayan: Hermes Agent — 22 Haziran 2026*