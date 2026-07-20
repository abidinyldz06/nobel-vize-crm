# Nobel Vize CRM — Teknik İnceleme ve Yol Haritası

Son inceleme: 20 Temmuz 2026
İncelenen başlangıç sürümü: `36ea267`

## Amaç

Bu belge, Nobel Vize CRM'in güvenli ve sürdürülebilir biçimde geliştirilmesi için yaşayan teknik kayıt ve faz planıdır. Her faz ayrı bir dalda uygulanır; değişiklikler üretim derlemesi, statik analiz ve ilgili testlerden geçmeden ana dala gönderilmez.

## Mevcut ürün kapsamı

Uygulama müşteri, vize başvurusu, evrak, randevu, ödeme, personel, iletişim, raporlama ve müşteri portalı akışlarını kapsıyor. Akıllı evrak kuralları ve vize alanına özgü veri modeli ürünün güçlü farklılaştırıcılarıdır.

## Öncelikli bulgular

### P0 — Kritik güvenlik

- Portal migration'ı `customers`, `applications`, `documents` ve `payments` tablolarının tamamını anonim okumaya açıyor. Portal erişimi token doğrulayan sunucu katmanına taşınmalı ve anonim politikalar kaldırılmalı.
- Bazı eski SQL dosyaları temel tablolarda RLS'yi tamamen kapatıyor. Canlı şema envanteri alınmalı ve tek migration kaynağı oluşturulmalı.
- Evrak storage bucket'ı public kuruluyor. Private bucket ve yetkili/süreli erişim kullanılmalı.
- Google Form webhook'u imza ve tekrar saldırısı koruması olmadan service-role istemcisi kullanıyor.
- Personel hesapları ortak `123456` şifresiyle oluşturuluyor. Davet bağlantısı akışına geçilmeli.
- Bazı ekranlarda personel kaydı bulunamadığında kullanıcı admin kabul ediliyor. Yetkilendirme her zaman kapalı varsayımla çalışmalı.
- `/api` yolları proxy kapsamı dışında; bazı endpoint'lerde açık oturum veya admin kontrolü eksik.

### P1 — Veri modeli ve bütünlük

- `visa_requirements`, `country_visa_requirements` ve `country_visa_rules` referansları aynı kod tabanında birlikte bulunuyor.
- Güncel `country_visa_rules` tablosunu kuran sürümlü migration depoda yok.
- `activity_log.performed_by` bazı şemalarda UUID, bazı kod yollarında e-posta veya isim olarak kullanılıyor.
- Müşteri, başvuru, evrak ve log oluşturma akışları transaction kullanmıyor; kısmi kayıt bırakabilir.
- Yedekleme eski tablo listesini kullanıyor ve restore işlemi transaction olmadan önce mevcut veriyi siliyor.

### P2 — İşlevsel doğruluk

- Dashboard aktif başvuru sayısını yalnızca son beş kayıt üzerinden hesaplıyor.
- Yıllık rapor, altı aylık filtre uygulanmış veri kümesinden türetiliyor.
- Arama endpoint'i eski/nonexistent `visa_requirements` tablosuna başvuruyor.
- Webhook ve import akışları yeni akıllı evrak kurallarıyla aynı modeli kullanmıyor.

### P3 — Kod kalitesi ve operasyon

- Üretim derlemesi başarılı olmakla birlikte başlangıç incelemesinde ESLint 156 hata ve 40 uyarı bildirdi.
- `npm run lint`, Next.js 16'da kaldırılmış `next lint` komutunu kullanıyor.
- Otomatik test ve GitHub Actions kalite kapısı bulunmuyor.
- `xlsx` bağımlılığı için yüksek önem dereceli güvenlik bildirimleri bulunuyor.
- README Next.js 14 yazarken proje Next.js 16 kullanıyor.

## Faz planı

### Faz 0 — Güvenlik ve veri koruma

- [x] Merkezi kullanıcı/personel/admin yetki yardımcıları
- [x] Fail-closed rol kontrolleri
- [x] API route kimlik ve rol kontrolleri
- [x] İmzalı ve zaman damgalı Google Form webhook'u
- [x] Personel davet akışı; ortak şifrenin kaldırılması
- [x] Portalın yalnızca sunucu üzerinden erişmesi
- [x] Anonim portal politikalarını kaldıran migration (staging/canlı uygulaması bekliyor)
- [x] Storage bucket'ı private yapan migration (staging/canlı uygulaması bekliyor)
- [x] Recursion oluşturmayan admin/danışman RLS politikaları (staging/canlı uygulaması bekliyor)
- [x] Otomatik ilk-admin bootstrap davranışının kaldırılması
- [x] Tehlikeli restore akışının korumaya alınması
- [x] Temel güvenlik başlıkları ve ortam değişkeni dokümantasyonu
- [ ] Canlı Supabase şema ve politika envanteri
- [ ] Migration'ın staging uygulaması ve rol/portal/evrak regresyon testi
- [ ] Güvenlik paketinin canlıya kontrollü alınması

### Faz 1 — Veritabanı standardizasyonu

- [ ] Canlı şema envanteri ve yedek
- [ ] Supabase CLI migration zinciri
- [ ] Tek ülke/vize kuralı modeli
- [ ] Foreign key, enum/check ve indekslerin standardizasyonu
- [ ] Kritik iş akışları için transaction/RPC
- [ ] Sürümlü ve atomik backup/restore
- [ ] SaaS hedefleniyorsa tüm iş tablolarında `tenant_id` izolasyonu

### Faz 2 — Stabilizasyon ve kalite

- [ ] Dashboard ve rapor hesaplarının düzeltilmesi
- [ ] Supabase üretimli TypeScript tipleri
- [ ] ESLint borcunun temizlenmesi
- [ ] Unit ve entegrasyon testleri
- [ ] Playwright ile temel kullanıcı akışları
- [ ] GitHub Actions build/lint/test/audit kapıları
- [ ] Güvensiz XLSX bağımlılığının değiştirilmesi

### Faz 3 — Ürünleştirme

- [ ] Nobel Vize iç CRM / çok kiracılı SaaS ürün kararının kesinleştirilmesi
- [ ] Marka, alan adı ve müşteri portalı stratejisi
- [ ] Onboarding, plan, kota ve faturalandırma
- [ ] Tenant bazlı white-label ve subdomain
- [ ] KVKK süreçleri: aydınlatma, açık rıza, saklama ve silme politikaları
- [ ] İzleme, hata raporlama, yedekleme tatbikatı ve olay müdahale planı

## Yayın kontrol listesi

Her değişiklik paketi için aşağıdakiler tamamlanmadan push/PR yapılmaz:

1. Değişiklik kapsamı ve diff gözden geçirilir.
2. `npm run build` başarılıdır.
3. Lint ve ilgili testler başarılıdır veya mevcut teknik borç açıkça belgelenmiştir.
4. Güvenlik açısından yeni secret, veri erişimi ve yetki yolları kontrol edilir.
5. Veritabanı migration'ı varsa geri dönüş ve staging uygulama adımları yazılır.
6. Commit mesajı ve sürüm notu değişikliğin gerçek kapsamını yansıtır.
