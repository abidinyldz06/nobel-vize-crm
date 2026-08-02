# Faz 5.2–5.3 — İletişim ve Operasyon Paketi

Tarih: 2 Ağustos 2026

Durum: Uygulama, migration, GitHub CI ve production deployment tamamlandı.
Gerçek e-posta gönderimi ile Google OAuth bağlantısı, gerekli Vercel
secret'ları ve yetkili sağlayıcı ayarları girilmediği için kasıtlı olarak
etkin değildir.

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

## Production aktivasyon listesi

1. Resend'de gönderici alanını doğrula; Vercel'e `MESSAGE_PROVIDER=resend`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` ve
   `RESEND_WEBHOOK_SECRET` ekle. Resend webhook hedefi
   `/api/webhook/messages` olmalıdır.
2. Google Cloud'da Calendar API etkin bir OAuth Web client oluştur; izinli
   redirect URI olarak
   `https://abidinyildiz.com/api/integrations/google-calendar/callback`
   gir. Vercel'e `NEXT_PUBLIC_APP_URL`,
   `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`,
   `GOOGLE_CALENDAR_STATE_SECRET` ve
   `CALENDAR_TOKEN_ENCRYPTION_KEY` ekle.
3. Deployment sonrasında bir yönetici/danışman Google Takvim'i bağlar ve bir
   test randevusunda gidiş–dönüş eşitlemeyi kabul eder. Bu, gerçek sağlayıcı
   kabulünün son adımıdır.

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
