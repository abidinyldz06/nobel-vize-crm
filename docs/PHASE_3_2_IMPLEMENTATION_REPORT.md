# Faz 3.2 — Tek Şirket Arayüz Temizliği Uygulama Raporu

Tarih: 21 Temmuz 2026
Dal: `phase-3/3.2-single-company-ui`
Durum: **Tamamlandı**

## Uygulanan değişiklikler

- Public `/pricing` SaaS fiyatlandırma sayfası kaldırıldı.
- Ayarlar ekranındaki plan, fatura, subdomain ve white-label bölümleri
  kaldırıldı.
- Herhangi bir e-posta, WhatsApp veya hatırlatma işlemi başlatmayan sahte
  bildirim anahtarları arayüzden ve şemadan kaldırıldı. Gerçek görev/bildirim
  sistemi Faz 3.3 kapsamında geliştirilecek.
- Ayarlar ekranı yalnız mevcut Nobel Vize şirket kaydını güncelliyor; tarayıcı
  artık ikinci bir şirket kaydı oluşturamıyor.
- `tenants` tablosu migration ile bir kayıtla sınırlandı. Boş ortamda varsayılan
  `Nobel Vize` kaydı oluşturuluyor; birden fazla mevcut kayıt varsa migration
  veri silmek yerine güvenli biçimde duruyor.
- Kullanılmayan `subdomain`, `plan`, `primary_color`, `notify_email`,
  `notify_whatsapp`, `notify_reminder` ve `notify_status_change` sütunları
  kaldırıldı.
- Uygulama başlığı `Nobel Vize CRM` olarak sadeleştirildi.

## Yerel doğrulama

| Kontrol | Sonuç |
|---|---|
| Production şirket kayıt ön kontrolü | Geçti, 1 kayıt |
| Temiz Supabase migration reset | Geçti |
| Üretilmiş veritabanı tipleri | Eşleşiyor |
| Veritabanı lint | Geçti, 0 bulgu |
| pgTAP | Geçti, 34/34 |
| ESLint | Geçti |
| TypeScript | Geçti |
| Node testleri | Geçti, 17/17 |
| Dependency audit | High eşiği geçti; bilinen 2 moderate PostCSS bulgusu sürüyor |
| Production build | Geçti; `/pricing` rota listesinde yok |
| Playwright | Geçti, 5/5 |
| `/pricing` 404 regresyonu | Geçti |
| Oturumlu ayarlar temizliği | Geçti |

## Production sonucu

| Kontrol | Sonuç |
|---|---|
| GitHub application | Geçti |
| GitHub database | Geçti |
| GitHub browser | Geçti |
| Vercel Preview | Geçti |
| Uyumlu production uygulama yayını | Geçti |
| Production migration | Geçti, yerel/uzak 8/8 eşleşiyor |
| Production şema lint | Geçti, 0 bulgu |
| Tek şirket kaydı | Geçti, 1 kayıt |
| Kaldırılan eski sütunlar | Geçti, PostgREST 400 |
| Ana sayfa | HTTP 200 |
| Anonim ayarlar yönlendirmesi | HTTP 200, giriş ekranı |
| Kaldırılan `/pricing` | HTTP 404 |
| Geçersiz portal bağlantısı | HTTP 200, kontrollü mesaj |
| Geçerli müşteri portalı | HTTP 200, beklenen içerik |

Önce CI'dan geçmiş uyumlu uygulama production'a dağıtıldı, ardından
`202607210001_phase3_single_company_settings.sql` migration'ı uygulandı. Bu
sıra, eski uygulamanın kaldırılan sütunlara yazmaya çalışabileceği uyumsuzluk
penceresini engelledi. Smoke sırasında kullanılan geçici anahtar, şirket yanıtı
ve portal token dosyaları doğrulama sonunda silindi.

Bu kanıtlarla **Faz 3.2 tamamlandı**. Sonraki çalışma paketi Faz 3.3'tür.
