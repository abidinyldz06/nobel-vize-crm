# Faz 1 — Veritabanı Standardizasyonu Yayın Rehberi

Bu paket migration zincirini, veri kalite kontrollerini ve kritik yazma
işlemlerini tek PostgreSQL transaction'ı içinde çalışacak RPC'leri hazırlar.
Canlı veya staging Supabase projesine otomatik migration uygulanmaz.

## Kapsam

- Boş veritabanından tekrar üretilebilen temel şema
- Tek kanonik ülke/vize kuralı modeli: `country_visa_rules`
- Foreign key, check constraint, indeks ve `updated_at` standardizasyonu
- Atomik müşteri/başvuru/evrak/not/log oluşturma
- Atomik başvuru durumu ve aktivite güncelleme
- Sürümlü JSON yedeği ve tek transaction içinde geri yükleme
- Salt-okunur şema envanteri ve veri kalite ön kontrolü

Tenant stratejisi [ADR 0001](decisions/0001-single-tenant-until-product-decision.md)
ile kaydedilmiştir. Faz 1 mevcut Nobel Vize kurulumunu tek kiracılı tutar.

## 1. Yerel doğrulama

Docker Desktop çalışırken:

```bash
npm install
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run test:security
npm run lint
npm run build
```

`db:reset`, aşağıdaki dosyaları zaman damgası sırasıyla boş yerel veritabanına
uygular:

1. `202607190001_baseline_schema.sql`
2. `202607200001_phase0_lock_down_public_access.sql`
3. `202607200002_phase0_role_based_rls.sql`
4. `202607200003_phase1_schema_standardization.sql`
5. `202607200004_phase1_atomic_workflows.sql`
6. `202607200005_phase1_atomic_backup_restore.sql`

İş bitince yerel servisler `npm run db:stop` ile kapatılabilir.

## 2. Canlı şema envanteri ve yedek

Staging veya production üzerinde migration çalıştırmadan önce:

1. Supabase Dashboard'dan Point-in-Time Recovery durumunu kontrol edin.
2. Platform yedeğine ek olarak `supabase db dump` ile şema ve veri yedeği
   alın; dosyayı şifreli ve erişimi sınırlı konumda saklayın.
3. SQL Editor'da `supabase/scripts/phase1_schema_inventory.sql` çalıştırıp
   çıktıyı tarih/proje adıyla saklayın. Betik satır verisi ve secret yazdırmaz.
4. `supabase/scripts/phase1_data_preflight.sql` çalıştırın. Dönen bütün
   `issue_count` değerleri sıfır olmadan constraint doğrulamasına geçmeyin.

Yedek geri yükleme tatbikatı production yerine izole bir staging projesinde
yapılmalıdır. Storage içindeki dosya nesneleri JSON veritabanı yedeğine dahil
değildir; bucket nesneleri ayrıca yedeklenmelidir. `staff.user_id` değerleri
Supabase Auth kullanıcı UUID'lerine bağlıdır. Başka projeye geri yüklemede aynı
Auth hesapları kontrollü biçimde hazırlanmadıysa işlem güvenli biçimde tamamen
geri alınır.

## 3. Staging uygulaması

1. Supabase CLI ile doğru staging projesine bağlı olduğunuzu iki kez kontrol
   edin.
2. Bekleyen migration listesini görüntüleyin ve yalnızca yukarıdaki zincirin
   uygulanacağını doğrulayın.
3. Migration'ları staging'e gönderin.
4. Envanter ve veri ön kontrol betiklerini tekrar çalıştırın.
5. Uygulama ortam değişkenlerinde `ENABLE_ATOMIC_RESTORE=false` bırakın.
6. Aşağıdaki regresyon listesinin tamamını doğrulayın.

Migration içindeki check ve foreign key constraint'leri mevcut bozuk veriyi
kilitlememek için `NOT VALID` eklenmiştir. Veri kalite sayaçları sıfırlandıktan
sonra staging'de `ALTER TABLE ... VALIDATE CONSTRAINT ...` ile doğrulanmalı,
ardından aynı doğrulama production yayın planına alınmalıdır.

Tekrarlı personel kullanıcıları veya ülke/vize kuralları bulunursa migration
veriyi silmez ve ilgili unique indeksi uyarıyla atlar. Tekrarlar kontrollü biçimde
birleştirildikten sonra şu indeksler staging'de oluşturulmalıdır:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_user_id
  ON public.staff(user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_country_visa_rules_match
ON public.country_visa_rules (
  country_id,
  visa_category,
  COALESCE(travel_method, '*'),
  COALESCE(accommodation, '*'),
  COALESCE(occupation, '*'),
  COALESCE(with_children::TEXT, '*'),
  COALESCE(nationality, '*')
);
```

## 4. Regresyon kontrolleri

- Admin yeni müşteri ve başvuru oluşturabilir; evraklar ve aktivite kaydı aynı
  işlemde oluşur.
- Geçersiz ücret veya kural verildiğinde müşteri dahil hiçbir kısmi kayıt kalmaz.
- Danışman yalnızca kendisine atanan müşteride işlem yapabilir.
- CSV içe aktarma aynı satır için kısmi başvuru bırakmaz.
- İmzalı Google Form webhook'u kanonik kuralı kullanır ve tek kayıt oluşturur.
- Başvuru durumu ile aktivite kaydı birlikte güncellenir.
- Yeni yedek `format=nobel-vize-crm-backup` ve `version=2.0` içerir.
- Hatalı/eksik yedek veriyi silmeden reddedilir.
- Geri yükleme yalnızca admin, açık bakım bayrağı ve
  `x-confirm-restore: RESTORE_BACKUP_V2` başlığıyla çalışır.
- `documents` bucket private kalır; anonim tablo/policy erişimi açılmaz.
- Portal geçerli token ile yalnızca ilgili müşterinin sınırlı verisini gösterir.

## 5. Kontrollü geri yükleme

Geri yükleme normal çalışma sırasında kapalıdır. Yalnızca bakım penceresinde:

1. Mevcut veritabanının yeni platform ve CLI yedeğini alın.
2. İstenen v2 JSON dosyasını izole staging projesinde doğrulayın.
3. Uygulamada `ENABLE_ATOMIC_RESTORE=true` ayarlayıp yeniden deploy edin.
4. Admin olarak dosyayı yükleyin ve açık onay metnini kabul edin.
5. Kayıt sayıları, oturum, müşteri, başvuru, ödeme ve evrak ilişkilerini test
   edin.
6. Bayrağı yeniden `false` yapıp deploy edin.

RPC bir hata alırsa transaction'ın tamamı geri alınır. Yine de işlem öncesi
platform yedeği zorunludur.

## 6. Production ve geri dönüş

Production uygulaması ancak staging kanıtları ve güncel yedek doğrulandıktan
sonra ayrı bakım penceresinde yapılır. Kod eski sürüme döndürülebilir; veritabanı
migration'ları geriye doğru SQL ile sökülmez. Sorunda:

1. Yazma trafiğini durdurun.
2. Hata nedenine göre ileri-düzeltme migration'ı hazırlayın veya doğrulanmış
   platform yedeğini yeni/izole projeye geri yükleyin.
3. Private bucket'ı public yapmayın, anonim portal politikalarını geri eklemeyin.
4. Veri bütünlüğü doğrulanmadan trafiği açmayın.
