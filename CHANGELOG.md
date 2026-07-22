# Sürüm Notları (Changelog)

Bu dosyada Nobel Vize CRM projesine eklenen tüm yeni özellikler, düzeltmeler ve değişiklikler yer almaktadır.

## [Unreleased] — Faz 3.4 Başvuru ve Müşteri Operasyonu

### Başvuru yönetimi

- Personel, ülke, tarih ve gecikme filtreli yatay süreç panosu eklendi.
- Geçersiz aşama atlamaları veritabanında engellendi; durum, toplu durum ve randevu işlemleri atomik audit akışlarına taşındı.
- Müşteri düzenleme ve detay ekranlarına ülke, vize türü, seyahat aracı, konaklama, meslek, çocuk ve uyruk alanları eklendi.

### Müşteri deneyimi ve dashboard

- VIP, Acil, Reddi Var ve Premium hazır etiketleri; renkli rozet ve etiket filtresi eklendi.
- Telefon, WhatsApp, e-posta ve audit'li hızlı not eylemleri eklendi.
- Başvuru, evrak, ödeme, randevu, iletişim ve notları birleştiren dikey timeline eklendi.
- Altı aylık pasaport uyarıları ve aylık başvuru/onay/red/bekleyen/gerçekleşen gelir kartları eklendi.

### Kalite

- pgTAP, güvenlik, dashboard birim testleri ve birleşik Playwright kullanıcı akışı genişletildi.
- Production oturum yönlendirmesi yeni auth çerezini ayrı dashboard isteğinde okuyacak biçimde sağlamlaştırıldı.
- Eski production şemasındaki yinelenen başvuru-müşteri foreign key kaldırılarak PostgREST ilişki belirsizliği giderildi.
- Production-smoke modu, canlı ortam taban URL'si ve uzak sorgulara uygun bekleme süreleriyle eklendi.
- Faz 3.4 migration'ları, Vercel yayını ve oturumlu canlı E2E akışı doğrulandı.

## [Unreleased] — Acil Paket H2 Müşteri Arşivi

### Veri güvenliği

- Müşteri hard delete işlemi admin kontrollü soft delete akışına çevrildi.
- Arşivleme ve geri yükleme işlemlerine atomik audit kaydı eklendi.
- Aktif müşteri sorguları arşiv kayıtlarını dışarıda bırakacak biçimde güncellendi.
- Admin Arşiv ekranı, geri yükleme ve 30 gün sonrası kontrollü kalıcı silme eklendi.

### Kalite ve bağımlılıklar

- Arşivleme yaşam döngüsü için pgTAP, güvenlik regresyonu ve oturumlu Playwright testi eklendi.
- Next.js `16.2.11` sürümüne güncellendi; production bağımlılık audit bulguları giderildi.

## [Unreleased] — Faz 1 Veritabanı Standardizasyonu

### Veri bütünlüğü

- Boş veritabanından tekrar üretilebilen Supabase CLI migration zinciri eklendi.
- Ülke/vize kuralları `country_visa_rules` modelinde birleştirildi.
- Kritik foreign key, check constraint ve indeksler standardize edildi.
- Müşteri/başvuru oluşturma ile durum güncelleme işlemleri atomik RPC'lere
  taşındı.

### Yedekleme ve operasyon

- Sayfalı ve sürümlü v2 JSON yedeği ile transaction tabanlı atomik geri yükleme
  eklendi.
- Salt-okunur şema envanteri ve veri kalite ön kontrol betikleri eklendi.
- Yerel pgTAP testleri, Faz 1 yayın rehberi ve tek kiracılı mimari karar kaydı
  eklendi.

## Faz 0 Güvenlik Temeli

### Güvenlik

- Merkezi, kapalı-varsayımlı personel ve admin yetkilendirmesi eklendi.
- API route'ları aktif personel/admin kontrolüyle korundu.
- Google Form webhook'una HMAC-SHA256 imzası, zaman damgası ve tekrar olay engeli eklendi.
- Ortak personel şifresi kaldırıldı; Supabase güvenli davet akışına geçildi.
- İlk Auth kullanıcısını otomatik admin yapan davranış kaldırıldı.
- Müşteri portalı anonim tablo politikaları yerine sınırlı sunucu sorgularına taşındı.
- Evrak bucket'ı private erişime ve kısa süreli signed URL indirmeye taşındı.
- Admin/danışman ayrımını koruyan recursion-safe RLS migration'ı hazırlandı.
- Atomik olmayan restore işlemi varsayılan olarak devre dışı bırakıldı.

### Kalite ve dokümantasyon

- Teknik inceleme, faz yol haritası ve staging/canlı yayın rehberi eklendi.
- Webhook imzası ve kritik güvenlik regresyonları için otomatik testler eklendi.
- Harici Google Fonts derleme bağımlılığı kaldırıldı.
- Next.js 16 lint komutu düzeltildi ve temel HTTP güvenlik başlıkları eklendi.

## [v1.2.0] - Temmuz 2026

### ✨ Yeni Özellikler (Kosmosvize Modeli)
- **Akıllı Evrak Seçim Sistemi**: Ülke ve vize kategorisine ek olarak; seyahat aracı (uçak, tur vb.), konaklama (otel vb.), meslek, çocuk durumu ve uyruğa göre dinamik evrak listesi oluşturabilme özelliği eklendi.
- **Dinamik Kural Düzenleyici**: Yönetici panelindeki "Ülkeler" sayfasında, her bir ülke için sınırsız evrak kuralı tanımlayabilmenizi sağlayan yeni form modülü yazıldı.
- **Gelişmiş Form Eşleştirme**: Müşteri eklerken seçilen kriterleri hesaplayarak arka plandaki en uygun (spesifik) evrak kuralını tespit edip dosya içerisine atan "SmartDocumentSelector" geliştirildi.

### 🛠️ Değişiklikler ve İyileştirmeler (Veritabanı)
- `country_visa_requirements` tablosu devreden çıkartılarak daha kapsamlı alanlara sahip `country_visa_rules` tablosu oluşturuldu. Eski evrak kuralları (veri kaybı olmadan) yeni sisteme entegre edildi.

---

## [v1.1.0] - Temmuz 2026

### ✨ Yeni Özellikler (Log ve Yedekleme)
- **Sistem Logu (Audit Log)**: Tüm müşteri kayıt, güncelleme, belge ekleme, ödeme ve randevu gibi önemli aksiyonların kim tarafından (Danışman veya Admin) ne zaman yapıldığının takip edilebildiği "Sistem Logu" modülü eklendi.
- **Tam Veri Yedekleme**: Ayarlar sekmesine tüm Supabase tablolarını anlık olarak JSON dosyasında bilgisayara indirebilen güvenli yedekleme aracı (API Route tabanlı) dahil edildi.
- **CSV Dışa Aktarma**: Sistem kayıtlarının analiz amaçlı tablo (Excel vb.) programlarında açılabilmesi için tüm müşterilerin listesini CSV formatında indirebilme imkânı getirildi.

### 🐛 Hata Düzeltmeleri (Bug Fixes)
- **GoTrueClient Uyarısı**: Konsolda beliren "Multiple GoTrueClient instances detected in the same browser context" uyarıları giderildi. `@supabase/ssr` paketi optimize edilerek `supabase-browser.ts` içerisindeki client, Singleton tasarım desenine göre tekilleştirildi. Bileşenlerin her birinde yaşanan performans sorunlarının önüne geçildi.

---

## [v1.0.0] - Haziran 2026
- Projenin ilk stabil versiyonu canlıya alındı. Müşteri ekleme, evrak yükleme, ödeme takibi, müşteri portalı (extranet) ve yönetici/danışman dashboard grafikleri tamamlandı.
