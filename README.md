# Nobel Vize CRM

Nobel Vize acentesi için geliştirilmiş, Next.js ve Supabase tabanlı, modern ve kapsamlı Müşteri İlişkileri Yönetimi (CRM) projesidir. Müşterilerin vize başvuru süreçlerini, evrak takiplerini, ödemelerini ve şirket içi personel yönetimini tek bir platformdan yönetmeyi sağlar.

## Özellikler

- **Akıllı Evrak Seçim Sistemi (Kosmosvize Modeli)**: Müşterinin seyahat aracı, konaklama tipi, mesleği ve çocuk durumuna göre dinamik evrak listeleri üretimi.
- **Kapsamlı Müşteri Yönetimi**: Kişisel bilgiler, pasaport, iletişim geçmişi (arama, e-posta, WhatsApp) ve vize geçmişi takibi.
- **Gelişmiş Başvuru Takibi**: Süreç boyunca durum güncellemeleri, randevu yönetimi, kargo ve sonuçlandırma takibi.
- **Finansal Yönetim**: Vize harcı, ofis hizmet bedeli ve ödeme takibi (kısmi ödemeler, para birimi desteği).
- **Rol Bazlı Yetkilendirme**: Yönetici (Admin) ve Danışman erişim yetkileri. Danışmanlar sadece kendi müşterilerini görebilirken yöneticiler tüm sistemi görebilir.
- **Müşteri Portalı (Extranet)**: Müşterilerin kendilerine özel güvenli (token tabanlı) link üzerinden başvuru süreçlerini canlı takip edebilmeleri.
- **Audit Log (Sistem Logu)**: Hangi personelin hangi müşteri üzerinde ne zaman değişiklik yaptığının detaylı kaydı.
- **Görev ve Gerçek Bildirimler**: Personel bazlı manuel görevler; randevu, geciken evrak, bekleyen ödeme ve hareketsiz başvuru hatırlatmaları; kişiye özel okundu durumu.
- **Başvuru Süreç Panosu**: Kontrollü durum geçişleri, personel/ülke/tarih/gecikme filtreleri ve atomik audit kaydı.
- **Müşteri Deneyimi**: Kanonik başvuru bilgileri, renkli etiketler, hızlı iletişim/not eylemleri ve birleşik müşteri timeline'ı.
- **Operasyon Dashboard'u**: Aylık başvuru/onay/red/gelir metrikleri ile süresi dolan veya altı ay içinde bitecek pasaport uyarıları.
- **Yedekleme ve Dışa Aktarma**: Tam sistem yedeğini JSON olarak indirebilme, müşteri verilerini CSV olarak dışa aktarabilme.

## Teknoloji Yığını

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Lucide Icons, Recharts
- **Backend & Database**: Supabase (PostgreSQL), Supabase Auth, Row Level Security (RLS)
- **Deployment**: Vercel

## Kurulum ve Çalıştırma

Projeyi lokalde çalıştırmak için:

```bash
# Bağımlılıkları yükleyin
npm install

# .env.local dosyasını ayarlayın
# .env.example dosyasını .env.local olarak kopyalayın ve değerleri doldurun.
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...       # yalnızca sunucu
# GOOGLE_FORM_WEBHOOK_SECRET=...      # yalnızca sunucu
# ENABLE_ATOMIC_RESTORE=false          # normal çalışma için kapalı

# Geliştirme sunucusunu başlatın
npm run dev
```

## Güvenlik notları

- `SUPABASE_SERVICE_ROLE_KEY` ve `GOOGLE_FORM_WEBHOOK_SECRET` hiçbir zaman `NEXT_PUBLIC_` önekiyle tanımlanmamalıdır.
- Müşteri evrakları private Supabase Storage bucket'ında tutulur ve uygulama kısa süreli imzalı bağlantı üretir.
- Google Form webhook istekleri `x-webhook-timestamp`, benzersiz UUID biçiminde `x-webhook-id` ve `x-webhook-signature` başlıklarını göndermelidir. İmza, `${timestamp}.${eventId}.${hamJsonGövdesi}` metninin `GOOGLE_FORM_WEBHOOK_SECRET` ile HMAC-SHA256 özetidir.
- Veritabanı migration'ları önce staging ortamında uygulanmalıdır. Ayrıntılar `supabase/migrations/README.md` dosyasındadır.

## Yerel veritabanı doğrulaması

Docker Desktop çalışırken migration zinciri ve PostgreSQL testleri şu
komutlarla doğrulanabilir:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

Uygulama kalite ve tarayıcı kontrolleri:

```bash
npm run lint
npm run typecheck
npm test
npm run build

# Yerel Supabase çalışırken; ilk kullanımda `npx playwright install chromium`
npm run test:e2e:local
```

Pull request ve `main` push'larında GitHub Actions; uygulama, veritabanı ve
Chromium smoke testlerini ayrı kalite kapıları olarak çalıştırır.

Faz 1 staging/production adımları ve geri dönüş planı
`docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` dosyasındadır.

## Teknik yol haritası

Güncel güvenlik incelemesi ve faz planı için `docs/TECHNICAL_AUDIT_AND_ROADMAP.md` dosyasına bakın.

### Faz durumu

| Faz | Durum | Rapor |
|---|---|---|
| Faz 0 — Güvenlik ve veri koruma | Production'a uygulandı ve doğrulandı | `docs/PHASE_0_DEPLOYMENT_RUNBOOK.md` |
| Faz 1 — Veritabanı standardizasyonu | Production'a uygulandı ve doğrulandı | `docs/PHASE_1_IMPLEMENTATION_REPORT.md` |
| Faz 2 — Stabilizasyon ve kalite | Tamamlandı | `docs/PHASE_2_IMPLEMENTATION_REPORT.md` |
| Faz 3 — İç CRM ürünleştirme | Devam ediyor | `docs/PHASE_3_PLAN.md` |

Faz 3 alt aşama takibi:

- **Faz 3.1 — Tamamlandı:** production hazırlığı, güvenli migration ve yayın doğrulaması
- **Faz 3.2 — Tamamlandı:** tek şirket arayüzü, şema temizliği ve production doğrulaması
- **Acil Paket H2 — Tamamlandı:** müşteri soft delete, Arşiv, kontrollü kalıcı silme ve production doğrulaması (`docs/H2_CUSTOMER_ARCHIVE_REPORT.md`)
- **Faz 3.3 — Tamamlandı:** 3.3.1–3.3.7 bitti; görevler, kişisel bildirimler, otomatik hatırlatmalar, production migration ve canlı doğrulama tamamlandı (`docs/PHASE_3_3_IMPLEMENTATION_REPORT.md`)
- **Faz 3.4 — Uygulama tamamlandı, production doğrulaması bekliyor:** süreç panosu, başvuru profil alanları, etiketler, dashboard metrikleri, hızlı eylemler ve timeline (`docs/PHASE_3_4_IMPLEMENTATION_REPORT.md`)
- **Faz 3.5 — Bekliyor:** müşteri iletişimi ve portal
- **Faz 3.6 — Bekliyor:** KVKK ve veri yaşam döngüsü
- **Faz 3.7 — Bekliyor:** izleme ve iş sürekliliği
- **Faz 3.8 — Bekliyor:** son kalite ve kullanıcı kabulü

Ayrıntılı kapsam ve kabul ölçütleri `docs/PHASE_3_PLAN.md`; Faz 3.1 ve 3.2
kanıtları ilgili uygulama raporlarındadır. Bir aşama
staging/production kanıtı tamamlanmadan `Tamamlandı` olarak işaretlenmez.

### Production hotfix kayıtları

- 21 Temmuz 2026 — Staff/Auth bağlantısı ve RLS müşteri görünürlüğü:
  `docs/PRODUCTION_INCIDENT_20260721_STAFF_AUTH_LINK.md`

## Sürüm Notları (Changelog)
Geliştirme geçmişi ve sürüm notları için `CHANGELOG.md` dosyasına bakabilirsiniz.
