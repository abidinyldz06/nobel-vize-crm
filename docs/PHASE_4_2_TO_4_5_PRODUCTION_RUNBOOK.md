# Faz 4.2–4.5 Production Runbook

## 1. Yayın öncesi

1. Şifreli DB/Auth/Storage yedeğini doğrula.
2. Yerel `npm run release:verify` ve GitHub kalite kapılarını tamamla.
3. Vercel'e yalnız server secret olarak aşağıdakileri ekle:
   - `CRON_SECRET`: en az 32 rastgele bayt;
   - `BACKUP_ENCRYPTION_KEY`: tam 32 rastgele baytın base64 çıktısı;
   - `MESSAGE_PROVIDER=disabled`.
4. Sağlayıcı seçilmeden `MESSAGE_WEBHOOK_SECRET` veya gerçek gönderici
   kimliği tanımlama.
5. Secret değerlerini terminal, issue, PR, CI veya uygulama loguna yazma.

## 2. Yayın sırası

1. Beş migration'ı sırasıyla bağlı Supabase projesine uygula. Yeni kolonlar
   eski uygulamayla uyumludur; bu sırada MFA henüz uygulama tarafından
   zorlanmaz.
2. Uygulama release adayını yayınla.
3. Yeni deploy'un readiness kontrolünü doğrula.
4. Vercel cron yapılandırmasının plan tarafından desteklendiğini kontrol et.
5. Operasyon cron'unu aynı pencereyle iki kez çağır; ikinci sonuç `skipped`
   olmalı ve yinelenen görev oluşturmamalıdır.
6. Yedek cron'unu bir kez çalıştır; `backup_runs` kaydı verified olmalı ve
   private bucket'ta şifreli artifact bulunmalıdır.

## 3. MFA kabulü ve kurtarma

1. Admin ilk girişte authenticator QR kodunu bağlar ve güncel TOTP kodunu
   doğrular.
2. Danışman MFA politikası varsayılan olarak kapalıdır; admin ayarlardan
   açabilir.
3. Başka tarayıcıda oturum açıp Hesap Güvenliği ekranındaki cihaz listesini
   doğrula; “Diğerlerini kapat” sonrası diğer oturumun korumalı isteği
   reddedilmelidir.
4. Admin authenticator cihazını kaybederse, kimliği bağımsız kanaldan
   doğrulanan kullanıcı için Supabase yönetim konsolundan ilgili TOTP faktörü
   kaldırılır. İşlem sonrası kullanıcı yeniden enroll edilir ve olay
   kaydedilir.
5. MFA zorunluluğunu veritabanından topluca kapatmak normal kurtarma yöntemi
   değildir.

## 4. Yedek kontrolü

- Günlük cron sonrası `scheduled_job_runs` ve `backup_runs` incelenir.
- Artifact uygulama tarafından indirilmeden okunamaz olmalıdır.
- SHA-256, AES-GCM açma ve payload/Storage object hash doğrulaması zorunludur.
- Saklama: günlük 14, haftalık 8, aylık 12.
- En az aylık olarak izole restore tatbikatı çalıştırılır.
- Aynı Supabase projesi kesintisine karşı şifreli off-provider kopya işletim
  sorumluluğu olarak ayrıca sürdürülür.

## 5. Mesaj sağlayıcı başlangıç kapısı

Gerçek gönderim ancak aşağıdakiler yazılı karara bağlanınca ayrı bir release
ile açılır:

- e-posta ve/veya WhatsApp sağlayıcısı ile maliyet;
- doğrulanmış gönderici alan adı veya telefon numarası;
- transactional/marketing amaçları ve KVKK iletişim politikası;
- sandbox kimlik bilgileri, webhook imza biçimi ve IP/secret rotasyonu;
- retry, bounce, ret ve teslimat kabul senaryoları.

Bu karar öncesinde queue worker `skipped/provider_not_configured` döner ve
hiçbir kayıt teslim edildi olarak işaretlenmez.

## 6. Olay ve geri dönüş

1. Hatalı cron'da ilgili Vercel cron'u devre dışı bırak.
2. `operational_events`, `scheduled_job_runs`, `backup_runs` ve
   `security_events` kayıtlarını request ID/error code üzerinden incele.
3. Secret sızıntısı şüphesinde ilgili secret'ı döndür ve deploy'u yenile.
4. Veri bütünlüğü bozulduysa yeni yazmaları durdur, doğrulanmış recovery point
   seç ve izole restore tatbikatından sonra kontrollü restore uygula.
5. Olay kapanmadan GitHub issue veya faz kabul kutusunu kapatma.
