# Faz 4.6–4.9 Uygulama ve Kapanış Raporu

Tarih: 28 Temmuz 2026

Durum: Faz 4.6, 4.7 ve 4.8 kod, migration, test ve dokümantasyon olarak release
adayı seviyesinde tamamlandı. Faz 4.9 teknik kalite kapıları tamamlandı;
production migration/deployment ve canlı kabul kanıtı bu rapora eklendikten
sonra production kapanışı yapılacaktır. Faz 4.4 gerçek admin TOTP kabulü ile
Faz 4.5 gerçek mesaj sağlayıcı kararı ayrı açık bağımlılıklardır.

## 1. Faz 4.6 — Kontrollü KVKK yaşam döngüsü

- `/privacy` yönetici ekranında veri değiştirmeyen dry-run adayları gösterilir.
- Anonimleştirme bir, kalıcı silme iki farklı yönetici onayı ister.
- Hukuki saklama, arşiv bekleme süresi, onaylı ilgili kişi talebi, Storage
  temizliği ve son onaydan sonra doğrulanmış yedek fail-closed kapılardır.
- Manuel yürütücü ile günlük `05:00` privacy cron'u aynı kontrollü yürütücüyü
  kullanır.
- Privacy audit doğrudan update/delete edilemez; karar, aktör, gerekçe, zaman
  ve güvenli metadata saklanır.

## 2. Faz 4.7 — Lead operasyonları

- Lead kaynağı, kampanya, yönlendirme, hedef ülke, vize türü, takip zamanı ve
  sorumlu personel kaydedilir.
- Telefon, e-posta ve pasaport normalize edilerek müşteri/lead mükerrerleri
  açıklanabilir eşleşme nedeni ile gösterilir.
- Mevcut müşteri seçmeden veya yeni müşteri oluşturmayı açıkça onaylamadan
  mükerrer lead dönüşümü yapılmaz.
- Danışman yalnız kendisine atanmış lead kayıtlarını görür; admin kontrollü
  atama yapar.
- Geciken takipler Faz 4.2 operasyon cron'unda idempotent lead görevine
  dönüştürülür.

## 3. Faz 4.8 — Takvim ve gerçek raporlar

- Randevular için `scheduled`, `rescheduled`, `cancelled`, `no_show` ve
  `completed` durumları ile değiştirilemez olay geçmişi vardır.
- Aynı danışmanın zaman aralığı çakışmaları yetki sınırı içinde uyarılır.
- Europe/Istanbul randevuları UTC uyumlu ICS dosyası olarak dışa aktarılır.
- Ülke/vize sonucu, bekleyen tahsilat yaşlandırma, lead SLA ve danışman iş yükü
  metrikleri kanonik tablolardan hesaplanır.
- CSV ve PDF çıktıları ekranla aynı dönem parametresini ve RLS/yetki bağlamını
  kullanır.

## 4. Faz 4.9 — Bakım ve release güvenliği

- Uyumlu patch/minor Next.js, React, Supabase, Playwright, Tailwind, ESLint,
  Recharts ve yardımcı bağımlılıklar güncellendi.
- ESLint 10, TypeScript 7 ve Node tiplerinin ana sürüm yükseltmeleri yapılmadı.
- Haftalık npm Dependabot grubu yalnız patch/minor güncellemeleri toplar.
- GitHub Actions her pazartesi production dependency audit çalıştırır.
- PDF çıktısı için `pdf-lib@1.17.1` eklendi.

## 5. Migration sırası ve geri dönüş

1. `202607280008_phase46_privacy_lifecycle_automation.sql`
2. `202607280009_phase47_lead_operations.sql`
3. `202607280010_phase48_calendar_reporting.sql`
4. `202607280011_phase46_48_backup_compatibility.sql`

Migration'lar transaction içindedir. Production geri dönüşünde privacy ve
operasyon cron'ları durdurulur, yeni yazmalar kesilir ve şema parçalarını elle
silmek yerine production öncesi doğrulanmış DB/Storage recovery point kullanılır.

## 6. Toplu yerel kabul kanıtı

28 Temmuz 2026 release adayı kontrolü:

- ESLint ve TypeScript: başarılı;
- Node testleri: 65/65;
- production dependency audit: 0 yüksek/kritik ve toplam 0 production açığı;
- Next.js 16.2.12 production build: başarılı;
- temiz Supabase migration reset: başarılı;
- üretilen TypeScript veritabanı tip karşılaştırması: eşleşiyor;
- schema lint: 0 hata;
- pgTAP: 324/324;
- izole atomik restore drill: başarılı, 24 temel tablo ve 6 yeni Faz 4.6–4.8
  tablosu doğrulandı;
- Playwright Chromium: 26/26.

Kontrol sırasında bulunan ve kapatılan regresyonlar:

- generated lead normalize kolonlarının restore sırasında doğrudan yazılması;
- eski randevu yazmalarında boş `appointment_status` uyumluluğu;
- değiştirilemez audit trigger'ının FK cascade işlemlerini yanlış engellemesi;
- dashboard rozetlerinde WCAG AA renk kontrastı.

## 7. Production kapanış kontrol listesi

- [ ] Production öncesi şifreli DB/Storage recovery point `verified`.
- [x] Uzak migration dry-run yalnız `202607280008`–`202607280011` gösteriyor.
- [ ] Migration'lar production'a uygulandı.
- [ ] Vercel deployment başarılı ve production alias güncel.
- [ ] Liveness/readiness, login ve anonim rol izolasyonu doğrulandı.
- [ ] `/privacy`, `/leads`, `/appointments`, ICS ve rapor export akışları canlı
      kabul edildi.
- [ ] Faz 4.6–4.8 GitHub issue'ları production kanıtıyla kapatıldı.
- [ ] Faz 4.9 issue'unda 4.4/4.5 dış bağımlılıkları açıkça korundu.
