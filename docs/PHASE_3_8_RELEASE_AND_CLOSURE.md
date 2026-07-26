# Faz 3.8 Release Adayı ve Faz 3 Kapanışı

Tarih: 26 Temmuz 2026

Durum: Tamamlandı; GitHub kalite kapıları, production migration ve canlı
doğrulama kanıtı kapanış pull request'inde tutulur.

Release adayı: `agent/phase-3-8-closing-quality-release`

## 1. Release kapsamı

Bu paket yeni ürün özelliği eklemez. Faz 3.1–3.7 ile teslim edilen tek şirketli
iç CRM'i aşağıdaki kapanış kapılarına bağlar:

- migration sürüm sırası ve üretilen TypeScript veritabanı tipleri;
- tüm `public` iş tablolarında RLS;
- anonim/PUBLIC tablo ve fonksiyon yetkilerinin sıfır olması;
- tüm `SECURITY DEFINER` fonksiyonlarında sabit boş `search_path`;
- audit actor trigger'ı ile boş action/actor kaydının bulunmaması;
- aktif personelde zorunlu Auth bağlantısı ve benzersiz `staff.user_id`;
- lint, typecheck, Node, production dependency audit ve build;
- pgTAP, tam Playwright kabul paketi ve izole restore tatbikatı.

## 2. 3.8.6 bitti — Güvenlik ve kalite kapıları

İncelemede RLS açık olmasına rağmen bazı yeni tablolarda Supabase'in tarihsel
varsayılanlarından kalan anonim `TRUNCATE`, `REFERENCES` ve `TRIGGER` yetkileri
bulundu. RLS bu yetkileri engellemediğinden kapanış migration'ı:

- `public` tablolarındaki tüm `PUBLIC` ve `anon` yetkilerini kaldırır;
- `public` fonksiyonlarındaki varsayılan `PUBLIC`/`anon` çalıştırma yetkisini
  kaldırır;
- trigger fonksiyonlarının doğrudan `authenticated` çağrısını kapatır;
- gelecekteki tablo ve fonksiyonlar için güvenli default privilege tanımlar;
- aktif personelin `user_id` değerinin `NULL` olmasını engeller.

`phase38_release_gates.test.sql` bu kuralları katalog seviyesinde doğrular.
`release-gates.test.ts` migration adlandırma/sıra kurallarını ve GitHub kalite
işinin eksiksiz kalmasını regresyon testine bağlar.

Production bağımlılık ağında yüksek/kritik açık kabul edilmez.
`npm run audit:production` hem yerel kalite komutunda hem GitHub application
işinde bloklayıcıdır.

## 3. 3.8.7 bitti — Kullanıcı kabulü, yedek ve geri dönüş

Kullanıcı kabul oturumu, ürün sahibinin Faz 3 boyunca tanımladığı günlük
senaryoların gerçek Chromium oturumunda çalıştırılmasıyla yürütülür:

- admin müşteri oluşturma, başvuru, randevu, evrak ve ödeme zinciri;
- danışman rol izolasyonu ve boş durumlar;
- görev, bildirim, iletişim, portal, KVKK, arşiv ve timeline;
- mobil/masaüstü responsive, klavye ve WCAG kontrolleri;
- hata, eşzamanlılık, tekrar deneme ve temiz fixture kapanışı.

Tek komutluk release adayı doğrulaması:

```sh
npm run release:verify
```

Komut uygulama kalite kapılarını, temiz migration resetini, üretilen DB tipi
diff'ini, schema lint'i, tüm pgTAP testlerini, transaction sonunda `ROLLBACK`
yapan restore tatbikatını ve tam Playwright paketini çalıştırır. Herhangi bir
adım başarısızsa release adayı push edilmez.

Production migration öncesinde:

1. `npx supabase db push --linked --dry-run` yalnız kapanış migration'ını
   göstermelidir.
2. Güncel DB ve private `documents` Storage içeriği repo dışında yedeklenip
   şifrelenmelidir.
3. Şifreli paketin SHA-256 ve açma/listeme kontrolü doğrulanmalıdır.
4. İzole restore tatbikatında `RESTORE_DRILL_OK` görülmelidir.

### Geri dönüş

- Uygulama sorunu varsa Vercel'de önceki başarılı production commit'i
  `9387729` yeniden yayınlanır.
- Yeni Auth-link constraint'i beklenmeyen tarihsel veriyi engellerse yalnız
  `staff_active_requires_auth_link` constraint'i kontrollü bakım penceresinde
  kaldırılır ve olay kaydı açılır.
- Anonim/PUBLIC yetkileri güvenlik düzeltmesidir; uygulama rollback'i için
  yeniden açılmaz.
- Restore, yalnız Faz 3.7 rehberindeki iki kontrolcü ve yedek kapıları
  tamamlandıktan sonra uygulanır.

## 4. 3.8.8 bitti — Production doğrulaması ve kapanış

GitHub application, database, browser ve Vercel kapıları yeşil olmadan pull
request birleştirilmez. Birleştirme sonrası:

1. production deployment `Ready` olmalıdır;
2. uzak migration zincirinde `202607260003` görünmelidir;
3. production schema lint hata vermemelidir;
4. anonim/PUBLIC tablo ve fonksiyon yetkisi sorguları sıfır dönmelidir;
5. aktif ve Auth bağlantısız personel sayısı sıfır olmalıdır;
6. aşağıdaki komut liveness, readiness ve login rotasını doğrulamalıdır:

```sh
npm run production:verify
```

Kanıt satırları `PRODUCTION_CHECK_OK` ile başlar. Pull request, GitHub Actions
run'ı, Vercel deployment ve migration kimlikleri GitHub kapanış kaydında
saklanır; secret ve kişisel veri rapora yazılmaz.

Production katalog doğrulaması, eski kurulumdan kalan ve uygulama sorgularında
kullanılmayan `appointments` tablosunda RLS'in kapalı olduğunu yakaladı.
`202607260004_phase38_legacy_appointments_rls.sql` tabloyu silmeden RLS'i
etkinleştirir ve anonim yetkileri kapatır. Böylece production drift'i veri kaybı
oluşturmadan migration zincirine alınmıştır.

## 5. Bilinen sınırlamalar

- Sistem tek şirketli iç CRM'dir. SaaS/tenant, paket, kota, faturalandırma,
  white-label ve subdomain kapsam dışıdır.
- Uygulama JSON yedeği Storage envanterini içerir, belge binary'lerini içermez;
  tam kurtarma için private bucket ayrıca yedeklenmelidir.
- Otomatik KVKK/30 günlük kalıcı silme arka plan görevi varsayılan olarak
  kapalıdır; admin kontrollü manuel akış kullanılmaktadır.
- `npm audit` geliştirme ağında, yalnız lint araç zincirindeki eski
  `brace-expansion` ana sürümleri nedeniyle yüksek uyarı raporlar. Doğrudan
  düzeltilebilen `js-yaml` ve yeni `brace-expansion` ağacı güncellenmiştir.
  Kalan uyarının önerdiği ESLint 10, mevcut Next React lint eklentisiyle
  uyumsuz olduğu hedefli lint denemesinde doğrulanmıştır. Production ağında
  açık yoktur; upstream uyumlu sürüm çıktığında kaldırılacaktır.
- Production sonrası doğrulama veri değiştirmeyen health, login, migration ve
  güvenlik katalog kontrolleridir. Kritik yazma akışları izole release adayı
  üzerinde tam Playwright paketiyle doğrulanır.

## 6. Faz 3 sonucu

Faz 3.1–3.8 tamamlanmıştır. Yeni ürün geliştirmesi ayrı bir faz olarak
planlanmalı; bu kapanış matrisindeki güvenlik, test, yedek ve yayın kapıları
korunmalıdır.
