# Veritabanı migration notları

Bu klasördeki dosyalar sıralı ve geri izlenebilir veritabanı değişiklikleridir.

## Uygulama kuralı

1. Canlı veritabanının yedeği alınır.
2. Migration önce staging Supabase projesinde uygulanır.
3. Login, admin, danışman, müşteri portalı, evrak yükleme ve indirme akışları test edilir.
4. Sonuçlar doğrulanmadan üretime uygulanmaz.

`supabase/schema_full.sql` temiz kurulum amacıyla tabloları silen komutlar içerir ve mevcut bir veritabanına migration olarak uygulanmamalıdır.

## Faz 0 ortam gereksinimi

Portal sunucu tarafında sınırlı sorgu çalıştırdığı için Vercel/Sunucu ortamında `SUPABASE_SERVICE_ROLE_KEY` bulunmalıdır. Bu değer hiçbir zaman `NEXT_PUBLIC_` önekiyle tanımlanmamalı veya tarayıcıya gönderilmemelidir.

## Faz 1 yerel doğrulama

Migration zinciri artık boş bir yerel Supabase veritabanından yeniden
üretilebilir. Docker Desktop çalışırken:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

Canlı veya staging uygulama, envanter, yedekleme, veri kalite kontrolü ve geri
dönüş adımları için `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` izlenmelidir. CLI ile
bağlı uzak projeye migration gönderme bu yerel komutların parçası değildir.

## Faz 4.2–4.5 ortam gereksinimleri

`202607280002`–`202607280006` migration'ları zamanlanmış operasyon, şifreli
yedek, MFA/giriş güvenliği ve sağlayıcı-bağımsız mesaj outbox tablolarını
ekler. Uygulama yayınıyla birlikte Vercel'de `CRON_SECRET`,
`BACKUP_ENCRYPTION_KEY` ve `MESSAGE_PROVIDER=disabled` tanımlanmalıdır.

Migration sırası değiştirilmemeli; production uygulama, MFA kabulü, cron ve
restore adımları için `docs/PHASE_4_2_TO_4_5_PRODUCTION_RUNBOOK.md`
izlenmelidir. Sağlayıcı kararı verilmeden mesaj provider değişkeni
etkinleştirilmemelidir.

## Faz 4.6–4.8 migration ve ortam gereksinimleri

`202607280008`–`202607280011` migration'ları kontrollü KVKK işlem kuyruğu,
lead yaşam döngüsü, randevu geçmişi/çakışma kontrolü ve bu tabloların atomik
backup/restore uyumluluğunu ekler.

- `automatic_actions_enabled=false` güvenli varsayılandır; KVKK cron'u bu
  ayar açık olmadan veri değiştirmez.
- Kalıcı silme iki ayrı admin onayı, son onaydan sonra `verified` yedek ve
  tamamlanmış Storage temizliği ister.
- Privacy cron'u her gün yedek cron'undan sonra `/api/cron/privacy` üzerinden
  çalışır ve mevcut `CRON_SECRET` değerini kullanır.
- Yeni kalıcı tablolar hem manuel v2 restore hem şifreli continuity paketine
  dahildir.

Production uygulamasından önce `202607280008`–`202607280011` dry-run çıktısı
kontrol edilmeli, mevcut DB/Storage recovery point doğrulanmalı ve migration
sonrası `/privacy`, `/leads`, `/appointments`, `/reports` kabul akışları
çalıştırılmalıdır.
