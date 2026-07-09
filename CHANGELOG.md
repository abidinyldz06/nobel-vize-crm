# Sürüm Notları (Changelog)

Bu dosyada Nobel Vize CRM projesine eklenen tüm yeni özellikler, düzeltmeler ve değişiklikler yer almaktadır.

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
