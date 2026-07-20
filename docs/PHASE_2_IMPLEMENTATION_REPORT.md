# Faz 2 — Stabilizasyon ve Kalite Uygulama Raporu

Tarih: 20 Temmuz 2026
Dal: `phase-2/stabilization-quality`
Taban: Faz 1 commit'i `528be63`

## Sonuç

Faz 2; hesaplama doğruluğu, veritabanı tip güvenliği, statik analiz, bağımlılık
güvenliği ve otomatik kalite kapıları kapsamında tamamlandı. Bu faz veritabanı
migration'ı içermez ve canlı Supabase ortamına değişiklik uygulamaz.

## Uygulanan değişiklikler

### Dashboard ve rapor doğruluğu

- Aktif başvuru sayısı artık son beş başvurudan türetilmiyor; tüm yetkili kayıt
  kümesi için ayrı count sorgusu kullanılıyor.
- Son başvurular sorgusuna kararlı `id` alanı eklendi; render sırasında
  `Math.random()` anahtar üretimi kaldırıldı.
- Aylık, geçen ay, yıllık ve altı aylık trend aralıkları UTC tabanlı, başlangıç
  dahil/bitiş hariç sınırlarla ayrıştırıldı.
- Yıllık ve aktif metriklerin altı aylık sorgudan türetilmesi kaldırıldı.
- Evrak tamamlanma durumu eski `tamamlandi` değeri yerine şemadaki kanonik
  `onaylandi` değeriyle hesaplanıyor ve güncelleniyor.
- Saf hesaplama fonksiyonları `src/lib/report-metrics.ts` altında toplandı.

### Supabase tip güvenliği

- Yerel migration zincirinden `src/types/database.ts` üretildi.
- Browser, server, admin ve proxy Supabase istemcileri `Database` generic'iyle
  bağlandı.
- Tiplerin görünür kıldığı şema uyumsuzlukları düzeltildi: ödemelerde olmayan
  `paid_at`, personelde olmayan `first_name/last_name`, nullable alanlar ve JSON
  evrak kuralları.

Tip yenileme komutu:

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

### ESLint ve kod kalitesi

- Faz başlangıcındaki ölçüm: 129 hata ve 37 uyarı.
- Faz sonu: 0 hata ve 0 uyarı.
- Açık `any` kullanımları alan veya sorgu tipleriyle değiştirildi.
- React effect içindeki senkron state güncellemeleri kaldırıldı.
- Login input/label bağları düzeltilerek erişilebilir seçim ve Playwright testi
  kararlı hale getirildi.

### XLSX bağımlılığı

- Yüksek önem dereceli bildirimi bulunan `xlsx` kaldırıldı.
- `.xlsx` okuma için `read-excel-file` kullanılıyor.
- CSV desteği korundu; eski `.xls` biçimi destek kapsamından çıkarıldı.
- `npm audit --omit=dev --audit-level=high` kalite kapısı geçiyor.
- Next.js'in gömülü PostCSS zincirinden gelen iki moderate bildirim kalıyor.
  Mevcut audit önerisi geriye dönük uyumsuz bir Next.js sürümüne yönlendirdiği
  için `--force` uygulanmadı; güvenli upstream güncellemesi takip edilmelidir.

### Test ve CI

- Node test runner ve Node 20 uyumlu `tsx` yükleyicisiyle hesaplama sınırları,
  aktif başvuru, ödeme, evrak ve süreç süresi testleri eklendi.
- Playwright Chromium smoke kapsamı:
  - giriş formu,
  - anonim kullanıcının korumalı sayfadan yönlendirilmesi,
  - public fiyatlandırma sayfası,
  - imzasız webhook isteğinin reddedilmesi.
- `.github/workflows/quality.yml` üç bağımsız iş çalıştırır:
  - uygulama: lint, TypeScript, Node testleri, high audit ve production build,
  - veritabanı: local Supabase start/reset, üretilmiş tip drift kontrolü,
    lint ve pgTAP,
  - tarayıcı: local Supabase ve Chromium Playwright smoke testleri.

## Doğrulama matrisi

| Kontrol | Komut | Sonuç |
|---|---|---|
| ESLint | `npm run lint` | Geçti, 0 bulgu |
| TypeScript | `npm run typecheck` | Geçti |
| Node testleri | `npm test` | Geçti, 16 test |
| Playwright | `npm run test:e2e:local` | Geçti, 4 test |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | Geçti; 2 moderate kaldı |
| Production build | `npm run build` | Geçti |
| Veritabanı lint | `npm run db:lint` | Geçti, şema hatası yok |
| pgTAP | `npm run db:test` | Geçti, 25 test |

## Yayın ve dal sırası

Faz 2, Faz 1 commit'i üzerinde geliştirilmiştir. Faz 1 PR #2, son yayın kontrolü
sırasında `main` dalına merge edilmiş olduğundan Faz 2 PR'ı doğrudan `main`
dalını hedefler. Push öncesinde bu rapordaki tüm kontroller ve diff incelemesi
yeniden çalıştırılmıştır.
