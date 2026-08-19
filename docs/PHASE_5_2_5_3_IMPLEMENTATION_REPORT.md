# Faz 5.2–5.3 — İletişim ve Operasyon Paketi

Tarih: 2 Ağustos 2026
Canlı aktivasyon güncellemesi: 19 Ağustos 2026

Durum: Uygulama, migration, GitHub CI, production deployment ve dış sağlayıcı
canlı kabulü tamamlandı. Resend gerçek teslimat webhook'u ile; Google ile giriş,
MFA sonrasında Dashboard erişimi ve Google Takvim gidiş-dönüş eşitlemesiyle
production'da doğrulandı.

## 5.2 — Gerçek e-posta teslimatı

- `MESSAGE_PROVIDER=resend` olduğunda e-posta, mevcut izin denetimli outbox
  üzerinden Resend'in e-posta API'sine gönderilir. Varsayılan değer
  `disabled` olduğundan eksik ya da yanlış ayarda hiçbir mesaj dışarı çıkmaz.
- Her gönderimde outbox idempotency anahtarı Resend'e iletilir; kuyruktaki
  lease/retry davranışı korunur.
- Resend Svix webhook imzası doğrulanır; kabul, teslim, bounce/complaint ve
  başarısız olayları idempotent biçimde iletişim/audit kaydına işler.
- WhatsApp Business sağlayıcısı bu pakete eklenmemiştir; ayrı ürün, maliyet
  ve gönderici onayı gerektirir.

## 5.3 — Portal ve operasyonlar

### Güvenli müşteri portalı evrak yükleme

- Portal yalnızca süresi geçmemiş müşteri token'ı ile, private `documents`
  bucket'ına tek dosyalık imzalı yükleme izni üretir.
- PDF, JPG/JPEG ve PNG kabul edilir; dosya boyutu 1–10 MiB ile sınırlandırılır.
- Yükleme tamamlandığında sunucu Storage metadatasını yeniden doğrular; yalnız
  doğrulanan yol, dosya türü ve boyut service-role veritabanı fonksiyonuyla
  evrak kaydına işlenir.
- Portal yüklemesi aktivite zaman çizelgesine yazılır ve aktif sorumluya
  uygulama içi bildirim oluşturur. Personelin yüklediği mevcut dosya portal
  tarafından ezilemez.

### Tahsilat ve danışman kapasitesi

- Bekleyen ödeme kaydına zorunlu son ödeme tarihi eklenir. Tarih geçince
  zamanlanmış operasyon tekilleştirilmiş ödeme görevi açar; eski kayıtlar için
  güvenli üç günlük varsayılan sürer.
- Yönetici, Personel ekranından kişi bazında aktif başvuru ve açık görev
  limitini kaydeder. Limit aşımları günlük operasyon çalışmasında danışmana
  haftalık tekilleştirilmiş bildirim olarak gelir.
- Bu limit ve ayar güncellemeleri audit kaydına eklenir.

### Google Calendar

- Her aktif personel Randevular ekranından kendi Google hesabını bağlayabilir.
- OAuth state'i HMAC ile imzalı ve on dakika sürelidir. Erişim ve yenileme
  token'ları AES-256-GCM ile şifrelenir; tarayıcı rolü token tablolarını
  okuyamaz.
- CRM randevuları Google Calendar'a gönderilir. Aynı bağlı etkinlikteki
  tarih, saat, süre, konum veya iptal değişikliği CRM'e ve randevu geçmişine
  geri yazılır.
- Google'da CRM bağlantısı olmayan etkinliklerden müşteri/başvuru
  oluşturulmaz; yanlış müşteri eşlemesini önleyen bilinçli güvenlik sınırıdır.
- `/api/cron/calendar` günlük eşitleme için Vercel Cron'a eklenmiştir; çalışan
  personel ayrıca ekrandan manuel eşitleme yapabilir.
- Senkronizasyon önce bağlı Google etkinliğindeki değişiklikleri CRM'e alır,
  sonra yenilenmiş CRM durumunu Google'a gönderir. Aynı iki eşitleme arasında
  iki taraf da değişmişse bağlı Google etkinliği belirleyici kabul edilir.

## Production aktivasyon sonucu

1. Resend sender ve production değişkenleri etkinleştirildi. 19 Ağustos 2026
   canlı test iletisi `resend` sağlayıcısı tarafından kabul edildi ve delivery
   webhook'u outbox kaydını `delivered` durumuna taşıdı.
2. Google Cloud Calendar API, production OAuth istemcisi, Vercel secret'ları,
   Supabase Google provider ve production dönüş adresleri yapılandırıldı.
3. Yönetici birincil Google Takvimini bağladı. Sentetik randevu CRM'den
   Google'a çıktı; Google'da 14:30'dan 15:15'e alınan saat ve değiştirilen konum
   CRM'e geri işlendi. Randevu geçmişi ve audit kaydı oluştu.
4. Canlı kabulte görülen “dışa aktarımın Google değişikliğini ezmesi” kusuru
   PR #66 ile düzeltildi. Kabul yeniden çalıştırıldıktan sonra test etkinliği
   silindi ve test müşterisi geri yüklenebilir arşive taşındı.

## Yerel kabul kanıtı

- Lint, TypeScript ve production build başarılı.
- 70 Node birim/güvenlik testi başarılı.
- Temiz migration reseti ve 376 pgTAP/RLS testi başarılı.
- İzole restore drill başarılı.
- 28 Chromium Playwright akışı başarılı; portal yükleme senaryosu dahildir.
- Production bağımlılık denetiminde yüksek/kritik açık bulunmadı.

## GitHub ve production kabul kanıtı

- PR #55 doğrulanan `4bbbdd72b941d02a7f149869b8829040248634dc`
  baş commit'i ile kontrollü squash merge edildi.
- Ana dal commit'i `894974940bea5fb91ccd6e3dd52a0e12e2968108` için
  GitHub Quality Gates uygulama, veritabanı ve 28 tarayıcı testiyle yeşildir.
- Vercel production deployment aynı ana dal commit'i için başarılıdır.
- Production Supabase migration geçmişi `202608020003`, `202608020004` ve
  `202608020005` dahil yerel zincirle eşleşir.
- `https://abidinyildiz.com/api/health/live` canlı kontrolde HTTP 200 ve
  `status: ok` döndürmüştür.

## 19 Ağustos canlı kabul kanıtı

- Google aktivasyonu: PR #65, merge commit
  `13f1b3bef3e97fef238b21122b091d09cf3ea15c`.
- İki yönlü eşitleme düzeltmesi: PR #66, doğrulanan baş commit
  `506da2c6742e2b13a36b35fa6c6c22d1c9a636e7`, merge commit
  `4ea59ebf2ab1991df02d512fd536ac14f7026bf9`.
- PR #66 Quality Gates run `32257231531`: application, database ve browser
  işleri başarılı; Vercel preview başarılıdır.
- PR #66 merge commit'i için ana dal Quality Gates run `32258157344`:
  application, database ve 30 browser senaryosu başarılıdır.
- Production deployment `dpl_Eh9sGkNNvzK7zYSqS4CSDcc9Qbbv`,
  `abidinyildiz.com` alias'ında `READY` durumundadır.
- Production bağlantısında `sync_enabled=true`, `last_sync_error=null` ve son
  temizleme eşitlemesi `2026-08-19T13:30:18.023Z` olarak doğrulandı.
- Ayrıntılı canlı test ve temizlik kaydı:
  `docs/PHASE_5_6_LIVE_ACCEPTANCE.md`.
