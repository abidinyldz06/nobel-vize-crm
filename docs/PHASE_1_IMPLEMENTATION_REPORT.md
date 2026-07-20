# Faz 1 — Uygulama ve Doğrulama Raporu

Tarih: 20 Temmuz 2026
Dal: `phase-1/database-standardization`

## Sonuç

Faz 1 kod paketi yerel ortamda tamamlandı ve doğrulandı. Canlı/staging Supabase
projesine migration uygulanmadı; uzak ortam envanteri, yedeği ve yayın
regresyonları [yayın rehberine](PHASE_1_DEPLOYMENT_RUNBOOK.md) göre ayrı bakım
penceresinde yürütülmelidir.

## Uygulanan değişiklikler

- Supabase CLI konfigürasyonu ve boş veritabanından tekrar üretilebilir baseline
  migration eklendi.
- `country_visa_requirements` verisini kaybetmeden kanonik
  `country_visa_rules` modeline taşıyan uyumluluk migration'ı eklendi.
- Personel, müşteri, başvuru, evrak, ödeme, iletişim ve ilişkili tablolar için
  kanonik foreign key'ler, check constraint'ler ve sorgu indeksleri eklendi.
- `activity_log.performed_by` gösterim metni ile
  `performed_by_staff_id` kimliği ayrıştırıldı.
- Müşteri + başvuru + evrak + not + aktivite oluşturma tek transaction RPC'sine
  taşındı.
- Başvuru durumu + aktivite kaydı tek transaction RPC'sine taşındı.
- CSV import ve imzalı Google Form webhook'u aynı kanonik RPC/kural modeline
  geçirildi.
- 1.000 satırlık sayfalama kullanan v2 JSON yedeği ve tek transaction içinde
  geri yükleme eklendi.
- Restore; admin rolü, kapalı-varsayımlı ortam bayrağı, açık onay başlığı,
  25 MB gerçek gövde sınırı ve RPC yetkileriyle korundu.
- Salt-okunur şema envanteri ve 18 veri kalite sayacı eklendi.
- Tek kiracılı kalma kararı ADR 0001 ile kaydedildi; tam tenant izolasyonu Faz 3
  ürün kararına bağlandı.

## Doğrulama kanıtları

| Kontrol | Sonuç |
| --- | --- |
| `npm run db:reset` | Başarılı; 6 migration temiz PostgreSQL'e sırasıyla uygulandı |
| `npm run db:lint` | Başarılı; public şemada hata/uyarı yok |
| `npm run db:test` | Başarılı; 25/25 pgTAP testi |
| Veri kalite ön kontrolü | Başarılı; 18/18 sayaç sıfır, kural tekrarı yok |
| Şema envanteri | Başarılı; RLS ve private documents bucket doğrulandı |
| Foreign key envanteri | Başarılı; 17 kanonik, tekrarsız FK |
| `npx tsc --noEmit` | Başarılı |
| Değiştirilen TS/TSX dosyalarında ESLint | Başarılı; 0 hata/uyarı |
| `npm run test:security` | Başarılı; 8/8 test |
| `npm run build` | Başarılı; Next.js 16 production build |
| `git diff --check` | Başarılı |

Genel `npm run lint` sonucu mevcut teknik borç nedeniyle 130 hata ve 38 uyarıdır.
Faz 1'in değiştirdiği dosyalar temizdir; depo genelindeki lint temizliği Faz 2
kapsamında tutulmuştur.

## Açık riskler ve kontrollü sonraki adımlar

1. Canlı şema ve veri henüz incelenmedi. Önce platform/CLI yedeği, sonra envanter
   ve veri kalite betikleri çalıştırılmalıdır.
2. Mevcut uyumsuz satırları yayın sırasında kilitlememek için bazı constraint'ler
   `NOT VALID` eklenir. Canlı sayaçlar sıfırlandıktan sonra ayrıca validate
   edilmelidir.
3. JSON yedeği Storage dosya binary'lerini içermez; bucket nesneleri ayrı
   yedeklenmelidir.
4. Başka Supabase projesine restore için yedekteki `staff.user_id` değerlerine
   karşılık gelen Auth kullanıcılarının bulunması gerekir.
5. Production bağımlılık denetimi 2 orta ve 1 yüksek bulgu bildirmiştir. Yüksek
   bulgu `xlsx` paketindedir ve npm üzerinde doğrudan düzeltme yoktur; bağımlılık
   değişimi Faz 2 maddesi olarak korunmuştur. Next.js'in gömülü PostCSS sürümü
   için orta bulguda npm'in önerdiği otomatik çözüm geçerli bir yükseltme değildir.

## Yayın kararı

Kod paketi taslak PR için uygundur. Staging ve production migration uygulaması bu
PR'nin otomatik parçası değildir; yayın rehberindeki yedek, envanter, regresyon
ve geri dönüş kapıları tamamlanmadan canlıya alınmamalıdır.
