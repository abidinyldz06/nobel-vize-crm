# Acil Paket H2 — Müşteri Arşivleme Uygulama Raporu

Tarih: 22 Temmuz 2026

Dal: `hotfix/h2-customer-soft-delete`

Durum: Yerel geliştirme ve doğrulama tamamlandı; production yayını bekliyor

## Sonuç

Müşteri silme işlemi doğrudan ve geri alınamaz `DELETE` davranışından çıkarıldı.
Normal kullanımda müşteri kaydı ve ilişkili başvuru, evrak, ödeme, randevu ve
iletişim verileri korunarak Arşiv'e taşınır. Arşivleme, geri yükleme ve 30 günü
dolduran kayıtların kalıcı silinmesi yalnız aktif admin tarafından çalıştırılır.

Bu acil paket Faz 3 numaralandırmasını değiştirmez. Mevcut Faz 3.3, görev ve
gerçek bildirim sistemi olarak sıradaki ana geliştirme aşamasıdır.

## Veritabanı ve güvenlik

- `customers.is_deleted` ve `customers.deleted_at` alanları eklendi.
- Silinme durumu ile tarihinin birlikte tutarlı olmasını sağlayan constraint ve
  aktif/arşiv sorguları için kısmi indeksler eklendi.
- Müşteri tablosundaki hard delete RLS politikası kaldırıldı.
- Normal müşteri SELECT, INSERT ve UPDATE politikaları aktif kayıtlarla
  sınırlandı.
- Arşivleme, geri yükleme, arşiv listeleme ve kalıcı silme işlemleri admin
  kontrolü yapan `SECURITY DEFINER` RPC'lere taşındı.
- Arşivleme ve geri yükleme değişikliği ile audit kaydı aynı transaction içinde
  tamamlanır.
- Arşiv audit metni `Müşteri silindi: {müşteri adı} — {personel adı}` biçimindedir.
- Kalıcı silme yalnız `deleted_at` üzerinden 30 günü dolduran seçili kayıtlarda
  çalışır. İşlem sonrası müşteri kimliğine bağlı olmayan kalıcı audit izi kalır.

## Uygulama davranışı

- Tekli ve toplu müşteri silme eylemleri Arşiv'e taşıma işlemine çevrildi.
- Arşivleme düğmeleri yalnız admin kullanıcılara gösterilir; sunucu ve
  veritabanı katmanı da rolü ayrıca doğrular.
- Aktif müşteri listeleri, arama, dashboard, rapor, personel performansı,
  randevu, portal, içe aktarma ve müşteri güncelleme akışları arşiv kayıtlarını
  dışarıda bırakır.
- Admin kullanıcılar için `/customers/archive` ekranı eklendi.
- Arşiv ekranında masaüstü ve mobil geri yükleme ile 30 gün sonrası kalıcı silme
  eylemleri bulunur.

## Bağımlılık güvenliği

Kalite kontrolü sırasında Next.js'in eski gömülü `sharp/libvips` sürümü için
yeni bir yüksek önem dereceli bildirim tespit edildi. Next.js `16.2.11` sürümüne
güncellendi; uyumlu `sharp 0.35.3` ve `postcss 8.5.15` sürümleri override ile
sabitlendi. Production bağımlılık audit'i sıfır bulguyla geçmektedir.

## Doğrulama matrisi

| Kontrol | Sonuç |
|---|---|
| Veritabanı sıfırlama ve migration zinciri | Geçti |
| Veritabanı lint | Geçti, şema hatası yok |
| pgTAP | Geçti, 55 test |
| ESLint | Geçti, 0 bulgu |
| TypeScript | Geçti |
| Node uygulama ve güvenlik testleri | Geçti, 18 test |
| Playwright Chromium | Geçti, 6 test |
| Üretilmiş Supabase tip drift kontrolü | Geçti |
| Production dependency audit | Geçti, 0 bulgu |
| Next.js production build | Geçti |

## Production yayın ve geri dönüş

Production'a geçişten önce güncel şifreli mantıksal yedek alınır ve mevcut
müşteri kayıtlarında silinme durumu ön kontrolü yapılır. Migration, GitHub kalite
kapıları geçip değişiklik `main` dalına alındıktan sonra `CRM` Supabase projesine
uygulanır. Ardından aktif müşteri sayısı, admin Arşiv ekranı, danışman erişimi,
audit ve arşivle–geri yükle smoke akışı doğrulanır.

Migration geri alınırken yeni kolonları hemen düşürmek yerine önce uygulama eski
sürüme döndürülür ve tüm arşiv kayıtları kontrollü biçimde aktif hale getirilir.
Veri kaybı riski nedeniyle production'da otomatik destructive rollback
çalıştırılmaz; gerekirse şifreli yedekten kontrollü geri yükleme uygulanır.
