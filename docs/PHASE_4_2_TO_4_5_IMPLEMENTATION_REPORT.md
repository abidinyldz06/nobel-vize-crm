# Faz 4.2–4.5 Uygulama Raporu

Tarih: 28 Temmuz 2026

Durum: Faz 4.2 ve 4.3 production'da tamamlandı. Faz 4.4 kodu ve migration'ı
production'da; gerçek admin TOTP enrollment ve oturum iptal kullanıcı kabulü
bekliyor. Faz 4.5 sağlayıcı-bağımsız temeli production'da, gerçek sağlayıcı
entegrasyonu ürün kararı verilene kadar bilinçli olarak kapalıdır.

## 1. Faz 4.2 — Zamanlanmış operasyon sistemi

- Vercel Cron için `CRON_SECRET` ile kapalı-varsayımlı Bearer doğrulaması
  eklendi.
- Pasaport, randevu, geciken evrak, bekleyen ödeme ve hareketsiz başvuru
  görevleri service-role zamanlayıcısına taşındı.
- Aynı saat penceresini tekrar çalıştırmayı engelleyen idempotency anahtarı,
  advisory lock ve `scheduled_job_runs` çalışma geçmişi eklendi.
- Başarısız çalışmalar kişisel veri veya secret taşımayan operasyon olayına
  dönüştürülür.

## 2. Faz 4.3 — Otomatik şifreli continuity yedeği

- İş veritabanı tabloları ile private `documents` Storage binary'leri aynı
  recovery point içinde dışa aktarılır.
- Paket, 32 baytlık ortam anahtarıyla AES-256-GCM kullanılarak uygulama
  katmanında şifrelenir; SHA-256 ve açma/doğrulama kontrolünden sonra private
  `continuity-backups` bucket'ına yüklenir.
- Günlük 14, haftalık 8 ve aylık 12 kopyalık retention otomatik uygulanır.
- Yedek çalışma geçmişi mevcut `backup_runs` kaydı ve zamanlayıcı geçmişiyle
  ilişkilidir. Faz 4.2–4.5 tabloları manuel yedek/restore uyumluluğuna eklendi.
- Bu hedef kaynak kod deposu dışındadır; aynı Supabase projesinde olması
  nedeniyle sağlayıcı-geneli felaket için başlangıçta alınan şifreli yerel
  yedek ayrıca korunmalıdır.

## 3. Faz 4.4 — Hesap ve giriş güvenliği

- Admin MFA zorunlu, danışman MFA politikayla yönetilebilir hale getirildi.
- Supabase TOTP enrollment/challenge ekranı, hesap güvenliği sayfası ve
  korumalı veri erişimine yakın AAL2 kontrolü eklendi.
- Beş başarısız denemede 15 dakikalık geçici kilit, sabit gecikme ve
  takma-adlandırılmış giriş anahtarı eklendi.
- Aktif Auth oturumları görüntülenebilir; mevcut oturum korunarak diğer
  oturumlar kapatılabilir.
- Giriş, MFA, parola ve oturum işlemleri secret/parola içermeyen güvenlik
  olaylarına yazılır.

## 4. Faz 4.5 — Sağlayıcıdan bağımsız iletişim temeli

- Kanal ve amaç bazında açık iletişim tercihi/ret kanıtı eklendi.
- Yetki, kanal izni ve pazarlama rızası kontrol edilen idempotent outbox RPC'si
  eklendi.
- Kontrollü retry, sağlayıcı arayüzü, HMAC webhook doğrulaması ve replay
  engelleme altyapısı eklendi.
- `accepted` olayı yalnız sağlayıcı kabulünü gösterir; CRM kaydı ancak
  `delivered` webhook'unda gönderildi durumuna geçer.
- `MESSAGE_PROVIDER=disabled` güvenli varsayılandır. Sağlayıcı, maliyet,
  gönderici alan adı/numarası ve hukuki politika seçilmeden gerçek teslimat
  açılmaz; mevcut `mailto:` ve `wa.me` eylemleri fallback olarak kalır.

## 5. Migration ve geri dönüş sırası

1. `202607280002_phase42_scheduled_operations.sql`
2. `202607280003_phase43_scheduled_encrypted_backups.sql`
3. `202607280004_phase44_account_security.sql`
4. `202607280005_phase45_message_outbox_foundation.sql`
5. `202607280006_phase42_45_backup_compatibility.sql`
6. `202607280007_phase43_service_backup_resolution.sql`

Migration'lar transaction içinde uygulanır. Production geri dönüşünde önce
cron'lar durdurulur ve yeni yazmalar kesilir. Şema geri dönüşü yerine
production öncesi doğrulanmış recovery point'ten restore tercih edilir; MFA
kolonlarını veya outbox kayıtlarını elle silmek veri/audit kaybı doğurabilir.

## 6. Kabul kanıtı

Toplu final doğrulamasında aşağıdaki kapılar birlikte çalıştırılır:

- ESLint, TypeScript, tüm Node testleri ve production dependency audit;
- temiz Supabase reset, şema lint'i, pgTAP ve üretilen tip karşılaştırması;
- şifreli yedek/restore tatbikatı;
- Playwright anonim erişim, cron yetkisiz erişim ve mevcut CRM regresyonları;
- Next.js production build.

Sonuçlar alınmadan commit, push veya production migration yapılmaz.

## 7. Production kabul sonucu

28 Temmuz 2026 tarihinde PR #45 ve production kabulünde bulunan yedek
doğrulama düzeltmesini içeren PR #46 bütün GitHub kapıları yeşilken merge
edildi.

- `202607280002`–`202607280007` migration'ları production ile eşleşiyor.
- Liveness, readiness ve ana sayfa `200` döndü.
- Üç cron endpoint'i secret olmadan `401` döndü.
- Operasyon cron'u ilk çağrıda başarılı oldu; aynı saat penceresindeki ikinci
  çağrı yinelenen iş oluşturmadan atlandı.
- İlk production yedek kabulünde bulunan service-role olay çözümleme kuralı
  ve başarısız günlük pencere retry açığı PR #46 ile kapatıldı.
- Son canlı yedek 269 veritabanı satırı ve 1 private Storage nesnesiyle
  şifreli recovery point oluşturdu; `backup_runs` kaydı `verified` oldu.
- Aynı günlük pencerenin ikinci yedek çağrısı
  `window_already_processed` sonucu verdi.
- Final yerel doğrulama 60 Node testi, 297 pgTAP, restore drill ve 24
  Playwright testiyle geçti; GitHub application, database, browser ve Vercel
  kontrolleri başarılı oldu.

Faz 4.4 tamamlandı olarak kapatılmadan önce gerçek admin hesabında QR/TOTP
enrollment ve diğer oturumları kapatma kabulü yapılmalıdır. Faz 4.5 ise gerçek
sağlayıcı, gönderici kimliği, maliyet ve hukuki politika kararı verilene kadar
yalnız güvenli temel olarak açık tutulur.
