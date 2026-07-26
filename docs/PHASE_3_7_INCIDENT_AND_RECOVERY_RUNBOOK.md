# Faz 3.7 Olay Müdahale ve Kurtarma Rehberi

Bu rehber Nobel Vize CRM production ortamındaki erişim, veritabanı, Storage,
webhook, yedekleme ve geri yükleme olayları için uygulanır. Müşteri verisi,
şifre, token, cookie, Supabase anahtarı veya ham hata mesajı olay kaydına ve
iletişim kanallarına kopyalanmaz.

## 1. Hizmet hedefleri

Bu değerler garanti değil, ekip içi operasyon hedefidir:

| Kapsam | RPO | RTO |
|---|---:|---:|
| Veritabanı kayıtları | en fazla 24 saat veri kaybı | 4 saat |
| Storage belge binary'leri | en fazla 24 saat veri kaybı | 8 saat |
| Web uygulaması / API | uygulanmaz | 2 saat |

Doğrulanmış son yedek 36 saati geçtiğinde sistem `backup.stale` uyarısı açar.
JSON yedeği veritabanı kayıtlarını ve Storage envanterini içerir; belge
binary'lerini içermez. Full continuity paketi için DB çıktısı ve private
`documents` bucket içeriği birlikte, repo dışında ve AES-256 ile şifreli
saklanmalıdır.

## 2. Olay seviyeleri

| Seviye | Örnek | İlk tepki hedefi |
|---|---|---:|
| SEV-1 | Production tamamen erişilemiyor, veri kaybı şüphesi, yetkisiz erişim | 15 dakika |
| SEV-2 | DB/Storage readiness başarısız, restore veya yedek başarısız | 30 dakika |
| SEV-3 | Webhook/görev senkronizasyonu bozuk, kısmi fonksiyon kaybı | 2 saat |
| SEV-4 | Tekil kullanıcı sorunu veya düşük etkili hata | 1 iş günü |

SEV-1 ve SEV-2 olaylarında önce değişiklik dondurulur. Production'a migration,
restore veya veri düzeltmesi uygulanmadan önce olay sahibi ve ikinci kontrolcü
belirlenir.

## 3. Tespit ve ilk inceleme

1. `/api/health/live` uygulama sürecini, `/api/health/ready` ortam, DB ve private
   Storage erişimini kontrol eder.
2. Ayarlar > Operasyon ekranında açık olay, hata kodu, route, tekrar sayısı ve
   request ID incelenir.
3. Vercel loglarında aynı request ID aranır. Loglar yalnız izinli alanları
   içerir; müşteri adı, e-posta, telefon, pasaport veya hata mesajı aranmaz ve
   rapora kopyalanmaz.
4. Son başarılı deployment, migration listesi ve doğrulanmış yedek zamanı
   kaydedilir.
5. Etki alanı belirlenir: web, auth/staff bağlantısı, DB, Storage, webhook,
   bildirim veya yedek.

## 4. Müdahale akışı

1. Olay kaydını aç ve SEV seviyesini ata.
2. Yeni deployment ve migrationları durdur.
3. Geri alınabilir en küçük düzeltmeyi izole/yerel ortamda doğrula.
4. `npm run quality`, `npm run db:lint`, `npm run db:test` ve ilgili Playwright
   senaryosunu çalıştır.
5. Production öncesi güncel DB + Storage continuity paketi al ve hash doğrula.
6. Değişikliği uygula; liveness, readiness, giriş, müşteri görünürlüğü ve ilgili
   iş akışını canlıda tekrar kontrol et.
7. Ayarlar > Operasyon ekranında olay ancak kanıtlar temizse kapatılır.

## 5. Yedekleme kontrol listesi

- Uygulama JSON yedeğini Ayarlar > Veri Yedekleme bölümünden indir.
- Tarayıcıdaki SHA-256 kontrolünün başarılı ve `backup_runs.status=verified`
  olduğundan emin ol.
- JSON içindeki `storage.object_count`, `storage.total_bytes` ve manifesti
  kaydet; `storage.included=false` olmalıdır.
- Supabase CLI ile repo dışındaki geçici dizine DB çıktısı al.
- Private bucket binary'lerini repo dışına indir:

```sh
npx supabase storage cp --linked --recursive ss:///documents /repo-disinda/documents
```

- DB çıktısı, uygulama JSON'u ve `documents` klasörünü tek arşivde birleştir.
- Arşivi AES-256-CBC + PBKDF2 ile, ayrı Keychain parolası kullanarak şifrele.
- Şifreli dosyanın SHA-256 değerini al; dosya iznini `600`, klasör iznini `700`
  yap.
- Şifre çözme ve arşiv listeleme kontrolü başarılı olmadan yedeği tamamlanmış
  sayma.
- Düz metin geçici DB/Storage dosyalarını doğrulama sonrası güvenli biçimde
  kaldır.

Auth kullanıcıları uygulama JSON restore kapsamına dahil değildir. Yeni bir
Supabase projesine felaket kurtarmada personel Auth hesapları yeniden
oluşturulmalı ve `staff.user_id` değerleri kontrollü biçimde eşleştirilmelidir.

## 6. İzole geri yükleme tatbikatı

Tatbikat production'a bağlanmayı reddeder ve yalnız
`127.0.0.1:54322/postgres` yerel Supabase veritabanında çalışır. Tüm değişiklik
tek transaction içindedir ve sonunda `ROLLBACK` yapılır.

```sh
npm run db:start
npm run restore:drill
```

Başarı kanıtı `RESTORE_DRILL_OK` satırıdır. Tatbikat:

- backup v2 verisini üretir,
- atomik restore fonksiyonunu çalıştırır,
- restore öncesi/sonrası tüm backup tablolarını birebir karşılaştırır,
- Storage nesne sayısının değişmediğini ve bucket'ın private kaldığını doğrular,
- payload SHA-256 ve satır sayısını raporlar,
- transactionı geri alır.

Başarısız tatbikatta production restore yapılmaz. Hata `restore.drill.failed`
olayı olarak kaydedilir ve neden giderilene kadar yedek “kurtarılabilir” kabul
edilmez.

## 7. Production restore kapısı

Production restore son çaredir. Şu kanıtların tamamı olmadan
`ENABLE_ATOMIC_RESTORE=true` yapılmaz:

1. Son yedeğin SHA-256 doğrulaması.
2. DB ve Storage envanterinin birlikte bulunması.
3. İzole restore tatbikatının başarılı olması.
4. Mevcut production'ın ayrıca şifreli acil durum yedeğinin alınması.
5. Olay sahibi ve ikinci kontrolcünün onayı.
6. Restore sonrası auth/staff eşleşmesi, RLS, müşteri sayısı, Storage dosya
   sayısı ve giriş testinin planlanmış olması.

Restore penceresi sonunda `ENABLE_ATOMIC_RESTORE` yeniden kapatılır.

## 8. Olay kapatma ve son değerlendirme

- Başlangıç/bitiş zamanı, SEV seviyesi, etki, kök neden ve request ID'ler yazılır.
- Uygulanan düzeltme, test kanıtları, deployment ve migration kimlikleri eklenir.
- Veri kaybı olduysa kapsam ve geri kazanılan son zaman noktası belirtilir.
- Gizli değerler ve kişisel veriler rapora eklenmez.
- Tekrarlamayı önleyici görev, sorumlu ve hedef tarih oluşturulur.
- Olay Ayarlar > Operasyon ekranında kapatılır; geçmiş kayıt silinmez.
