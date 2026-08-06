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

## Faz 5.4 ülke/vize kataloğu

`202608060001` migration'ı ülke/vize evrak kurallarına çoklu kaynak ve kontrol
bilgisi ekler. Uygulama kullanıcısının doğrudan kural yazma yetkisini kaldırır;
yönetici ekleme, güncelleme, kaynak doğrulama ve silme işlemleri kontrollü RPC
ve audit log üzerinden yürür.

İlk içerik paketi yalnız resmî kaynakla doğrulanan Almanya iş seyahati
kuralını günceller. Fransa turistik ve öğrenci bağlantıları kontrol kuyruğuna
eklenir; profile özel France-Visas Assistant çıktısı görülmeden doğrulanmış
sayılmaz. Production'a uygulamadan önce migration reset, pgTAP, üretilmiş tip
karşılaştırması ve tam release kapısı çalıştırılmalıdır.

## Faz 5.5 ülke ve evrak omurgası

`202608060002` migration'ı tek kural seçimi yerine genel kural ile açıkça
eşleşen profil eklerini birleştiren sunucu tarafı resolver'ı ve başvuruda
`matched_rule_ids` izini ekler. Profil düzenlendiğinde yeni gereken evraklar
eklenir; mevcut yükleme ve manuel evraklar korunur.

`202608060003` migration'ı Almanya, Fransa ve İtalya için turistik, iş,
öğrenci ve aile ziyareti temel listelerini; meslek, çocuk ve uyruk eklerini
kaynak statüsüyle birlikte oluşturur. Fransa'nın dört kategorisi ve İtalya iş
listesi kesin resmî profil çıktısı beklediği için doğrulanmış işaretlenmez.
Ayrıntılı kaynak matrisi ve kapanış kapıları
`docs/PHASE_5_5_COUNTRY_DOCUMENT_CORE.md` dosyasındadır.
