# Nobel Vize CRM — FAZ 1 DÜZELTME PROMPTLARI
**Tarih:** 22 Haziran 2026
**Proje:** ~/Desktop/nobel-vize-crm/ (Next.js 16 + Supabase)
**Canlı:** nobel-vize-crm.vercel.app

---

## PROMPT 1: Vize Geçmişi + Aile Üyesi Schema Düzeltmesi

```
Nobel Vize CRM'de iki panel schema uyumsuzluğu yüzünden çalışmıyor. Düzelt.

### 1. VisaHistoryPanel.tsx
DOSYA: src/components/VisaHistoryPanel.tsx

SORUN: Component insert için şu alanları kullanıyor:
- status, issue_date, expiry_date

AMA schema'da (supabase/schema_full.sql) şu alanlar var:
- result, application_date

ÇÖZÜM:
- `status` → `result` olarak değiştir
- `issue_date` → `application_date` olarak değiştir
- `expiry_date` kolonu schema'da yok — component'ten kaldır VEYA schema'ya ekle
- Form input label'larını Türkçe tut: "Sonuç" (Onaylandı/Reddedildi), "Başvuru Tarihi"
- expiry_date'i "Bitiş Tarihi" olarak formda tut, schema'ya `expiry_date DATE` kolonu ekle

### 2. FamilyMembersPanel.tsx
DOSYA: src/components/FamilyMembersPanel.tsx

SORUN: Component insert için şu alanları kullanıyor:
- first_name, last_name, relation

AMA schema'da şu alanlar var:
- full_name, relationship

ÇÖZÜM:
- `first_name` + `last_name` → `full_name` olarak birleştir (formda tek input "Ad Soyad")
- `relation` → `relationship` olarak değiştir
- Form label'lar Türkçe: "Ad Soyad", "Yakınlık" (Eş/Çocuk/Kardeş/Anne/Baba/Diğer)

ÖNEMLİ: Schema'da değişiklik yapacaksan supabase/schema_full.sql dosyasını güncelle. Component'lerle birebir uyumlu olsun.
```

---

## PROMPT 2: Ayarlar Sayfası — 4 Sekme Gerçek Kaydetme

```
DOSYA: src/components/SettingsClient.tsx

SORUN: 4 sekmeden HİÇBİRİ DB'ye gerçekten kaydetmiyor:
- Şirket: theme_color kolonu yok (schema'da primary_color var), error handling yok
- Tema: renk seçiliyor ama CSS'e uygulanmıyor
- Bildirimler: toggle'lar sadece CSS, state yok, DB'ye yazmaz
- Güvenlik: şifre input'ları boş, hiçbir action'a bağlı değil

AYRICA: import { supabase } from "@/lib/supabase" — UNAUTHENTICATED client kullanılıyor!

ÇÖZÜM:

### 1. Genel Düzeltme
- `import { supabase }` → `import { createSupabaseServerClient }` veya browser client kullan (client component olduğu için createSupabaseBrowserClient)
- Tüm supabase çağrılarında error handling ekle: `const { data, error } = await ...; if (error) { setError(...); return; }`
- "Kaydedildi!" mesajını sadece başarıyla kaydedince göster

### 2. Şirket Sekmesi
- `theme_color` → `primary_color` olarak değiştir (schema'da bu var)
- tenants tablosuna şu kolonlar ekle (schema_full.sql'e ekle):
  - `company_name TEXT`
  - `email TEXT`
  - `phone TEXT`
  - `notify_email BOOLEAN DEFAULT true`
  - `notify_whatsapp BOOLEAN DEFAULT true`
  - `notify_reminder BOOLEAN DEFAULT true`
  - `notify_status_change BOOLEAN DEFAULT true`
- Kaydet butonu tenants tablosuna upsert yapsın

### 3. Tema Sekmesi
- Seçilen rengi `primary_color` olarak tenants tablosuna kaydet
- AYNI ZAMANDA rengi CSS'e uygula:
  `document.documentElement.style.setProperty('--color-primary', selectedColor)`
- Renk değişince anında UI'da yansısın (preview mod)
- Sayfa yenilenince tenant'dan renk okuyup uygula

### 4. Bildirimler Sekmesi
- 4 toggle: E-posta Bildirimleri, WhatsApp Bildirimleri, Randevu Hatırlatma, Durum Değişikliği Bildirimi
- Her toggle useState ile yönetilsin
- Kaydet butonu tenants tablosuna notify_email, notify_whatsapp, notify_reminder, notify_status_change kolonlarına yazsın
- Sayfa açılınca tenants'tan mevcut değerleri oku, toggle'ları ona göre initialize et

### 5. Güvenlik Sekmesi
- 3 input: Mevcut Şifre, Yeni Şifre, Yeni Şifre (Tekrar)
- "Değişiklikleri Kaydet" butonu:
  1. Mevcut şifre ile supabase.auth.signInWithPassword doğrula
  2. Yeni şifre = confirm şifre mi kontrol et
  3. supabase.auth.updateUser({ password: newPassword }) çağır
  4. Başarı: "Şifreniz güncellendi" mesajı
  5. Hata: "Mevcut şifre hatalı" veya "Şifreler eşleşmiyor" mesajı
- Mevcut şifre input'u eklemeyeceksen (client component olduğu için zor) en azından:
  - Yeni şifre + tekrar input
  - supabase.auth.updateUser({ password }) çağır
  - "Şifre güncellendi" mesajı

ÖNEMLİ: SettingsClient bir "use client" component. Browser tarafında çalışıyor. Supabase browser client kullan (createSupabaseBrowserClient). Server client DEĞİL.
```

---

## PROMPT 3: Sidebar "Profilim" Kaldır + Ayarlar İçine Taşı

```
DOSYA: src/components/Sidebar.tsx

SORUN: Sidebar'da "Profilim" linki var (/profile) ama bu sayfa sadece şifre değiştirme içeriyor. Bu zaten Ayarlar > Güvenlik sekmesinde var. Gereksiz duplicate.

ÇÖZÜM:
1. Sidebar.tsx'de "Profilim" linkini KALDIR
2. Navigation listesinden çıkar:
   - Dashboard
   - Müşteriler
   - Ülke & Evraklar
   - Randevular
   - Personel
   - Raporlar
   - Ayarlar
   (Profilim YOK)

3. /profile sayfasını (/app/(main)/profile/page.tsx) ya sil ya da /settings'e redirect yap
4. Eğer şifre değiştirme /settings > Güvenlik'te çalışıyorsa (Prompt 2 ile), /profile'a gerek yok

ÖNEMLİ: Sidebar'ı güncellerken "Personel" linkinin sadece admin'de görünür olduğundan emin ol (mevcut kontrol var mı kontrol et, yoksa ekle).
```

---

## PROMPT 4: Müşteri Detay — "Mesaj Gönder" Buton Görsel Sorunu

```
DOSYA: src/app/(main)/customers/[id]/page.tsx
DOSYA: src/components/WhatsAppTemplates.tsx (veya ilgili component)

SORUN: Müşteri detay sayfasında evrak listesinin altında "Mesaj Gönder" butonu var. Tıklanınca dropdown/popup açılıyor ama yarısı çıkıyor yarısı çıkmıyor — görsel olarak taşma veya overflow sorunu var.

OLASI NEDENLER:
1. Dropdown'ın z-index'i düşük — diğer elementlerin arkasında kalıyor
2. Overflow: hidden olan bir container'ın içinde — taşan kısım kesiliyor
3. Position: absolute ama parent position: relative değil
4. Max-height yok, ekran dışına taşıyor

ÇÖZÜM:
1. "Mesaj Gönder" dropdown'ını açan component'i bul (WhatsAppTemplates veya doğrudan page.tsx)
2. Dropdown container'a şu CSS ekle:
   - `z-index: 50` (yüksek değer, diğerlerinin üstünde)
   - `position: absolute` (parent'ın `position: relative` olduğundan emin ol)
   - `overflow: visible` (parent'da overflow: hidden varsa kaldır veya dropdown'u dışarı taşı)
3. Eğer parent container `overflow: hidden` veya `overflow: auto` ise:
   - Dropdown'u parent'ın dışına taşı (portal/teleport pattern)
   - VEYA parent'ın overflow'unu visible yap
4. Dropdown'ın genişliği sabit olsun: `min-w-[300px]` veya `w-full`
5. Dropdown açılınca dışına tıklayınca kapansın (click-outside listener)

TEST: Müşteri detay sayfasını aç, "Mesaj Gönder" tıkla, dropdown tam görünür olmalı, taşma olmamalı.
```

---

## PROMPT 5: Şifre Sıfırlama Sayfası + Pricing Link

```
### 1. Şifre Sıfırlama Sayfası
DOSYA: src/app/reset-password/page.tsx (YENİ)

SORUN: LoginForm.tsx'de "Şifremi Unuttum" linki /reset-password'a yönlendiriyor ama bu sayfa yok. 404 verir.

ÇÖZÜM:
1. src/app/reset-password/page.tsx oluştur
2. Sayfa içeriği:
   - "Yeni Şifre Belirle" başlığı
   - Yeni şifre input (min 6 karakter)
   - Yeni şifre tekrar input
   - "Şifreyi Güncelle" butonu
   - supabase.auth.updateUser({ password: newPassword }) çağır
   - Başarı: "Şifreniz güncellendi, giriş yapabilirsiniz" + / redirect
   - Hata: mesaj göster
3. Bu sayfa Supabase şifre sıfırlama e-postasındaki linkten gelecek
4. Supabase Dashboard'da Auth > Redirect URLs'e /reset-password ekle

### 2. Pricing Link Düzeltme
DOSYA: src/app/pricing/page.tsx

SORUN: Satır 17'de `<Link href="/login">` — /login route'u yok. Login sayfası / (root)'ta.

ÇÖZÜM:
- `href="/login"` → `href="/"` yap
```

---

## PROMPT 6: WhatsApp Status + DocumentItem Duplicate Log

```
### 1. WhatsApp Templates Status Düzeltme
DOSYA: src/components/WhatsAppTemplates.tsx

SORUN: Satır 32'de `p.status === 'odendi'` filtreliyor. Ama sistemde ödeme status'ü 'alindi' (PaymentsPanel'de böyle kaydediliyor).

ÇÖZÜM:
- `p.status === 'odendi'` → `p.status === 'alindi'` değiştir
- EğerPaymentsPanel'de farklı bir status değeri kullanılıyorsa, oradaki değeri bul ve onu kullan

### 2. DocumentItem Duplicate Activity Log
DOSYA: src/components/DocumentItem.tsx

SORUN: toggleStatus fonksiyonunda iki kez activity_log insert ediliyor:
- Satır 25-29: ilk insert (doc.document_name kullanıyor — bu alan YOK)
- Satır 75-79: ikinci insert (duplicate)

ÇÖZÜM:
1. Satır 75-79'daki ikinci insert'i SİL
2. Satır 25-29'daki ilk insert'te `doc.document_name` → `doc.document_type` değiştir
3. Sadece TEK bir activity_log insert kalsın
```

---

## PROMPT 7: Staff + Appointment SSR Client Düzeltme

```
### 1. Staff Action SSR Client
DOSYA: src/app/actions/staff.ts

SORUN: Satır 2'de `import { supabase } from "@/lib/supabase"` — unauthenticated plain client.

ÇÖZÜM:
- `import { supabase } from "@/lib/supabase"` → `import { createSupabaseServerClient } from "@/lib/supabase-server"`
- Tüm supabase çağrılarını `const supabase = await createSupabaseServerClient()` ile başlat
- createStaff ve updateStaff fonksiyonlarında bu client'ı kullan

### 2. Appointment Page SSR Client
DOSYA: src/app/(main)/customers/[id]/appointment/page.tsx

SORUN: Satır 1'de `import { supabase } from "@/lib/supabase"` — unauthenticated plain client.

ÇÖZÜM:
- `import { supabase } from "@/lib/supabase"` → `import { createSupabaseServerClient } from "@/lib/supabase-server"`
- `const supabase = await createSupabaseServerClient()` ile başlat
- Tüm query'lerde bu client'ı kullan
```

---

## KULLANIM SIRASI

1. **Prompt 1** (Schema düzelt) → Gemini yap → push et
2. **Prompt 2** (Ayarlar 4 sekme) → Gemini yap → push et → Vercel'de test et
3. **Prompt 3** (Sidebar Profilim kaldır) → Gemini yap → push et
4. **Prompt 4** (Mesaj Gönder görsel) → Gemini yap → push et → test et
5. **Prompt 5** (Şifre sıfırlama + pricing link) → Gemini yap → push et
6. **Prompt 6** (WhatsApp + DocumentItem) → Gemini yap → push et
7. **Prompt 7** (SSR client) → Gemini yap → push et

Her prompt tamamlandığında bana söyle, Vercel'de test edeyim.

ÖNEMLİ: Prompt 2 en kritik olanı — Ayarlar sayfasının tamamını düzeltiyor. Önce onu yap.
```

---
*Hazırlayan: Hermes Agent — 22 Haziran 2026*