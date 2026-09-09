# Nobel Vize CRM

Nobel Vize acentesi için geliştirilmiş, Next.js ve Supabase tabanlı, modern ve kapsamlı Müşteri İlişkileri Yönetimi (CRM) projesidir. Müşterilerin vize başvuru süreçlerini, evrak takiplerini, ödemelerini ve şirket içi personel yönetimini tek bir platformdan yönetmeyi sağlar.

## Proje durumu ve raporlar

**Güncel durum (9 Eylül 2026):** Faz 5.0–5.7 production kabulü tamamlandı;
üzerine 6–9 Eylül güvenilirlik ve güvenlik paketi (PR #73) merge edildi.
Veri kalitesi, kaynaklı ülke/evrak kuralları, gerçek e-posta teslimi, Google ile
giriş, Google Takvim senkronizasyonu, public doğrulama sayfaları, mesaj outbox
güvenilirliği ve observability canlıdır. Google yayıncı doğrulaması dış
yönetişim işi olarak devam eder; WhatsApp Business ertelenmiştir.

### Yapılanlar (son güncel)

- **PR #73 (9 Eylül 2026, merge edildi):** portal log koruması, mesaj gönderim
  izin denetimi, izin denetimli e-posta outbox'ı, observability katmanı,
  veri kalitesi iç fonksiyonunun anon/Public EXECUTE erişiminin kapatılması
  (migration `202609090001`), sharp 0.35.4 güvenlik yaması
  (`docs/SECURITY_REPAIR_2026_09_09.md`).
- **PR #74 (9 Eylül 2026, merge edildi):** Dependabot patch/minor — 9 paket
  güncellemesi.
- **Faz 5.0–5.7 (20 Ağustos 2026):** production kabulü tamamlandı — veri kalite
  kuyruğu, şirket iletişim doğrulaması, kaynaklı ülke/evrak kataloğu, Resend
  gerçek teslimi + webhook, Google ile giriş, Google Takvim çift yönlü senkron,
  public doğrulama sayfaları.

### Yapılacaklar (öncelik sırasıyla)

1. **Ülke kuralları veri girişi** — Almanya tam; Fransa kısmen (France-Visas
   Assistant çıktısı bekleniyor); İtalya ticari liste güncellemesi; kalan 14
   Schengen + İngiltere/ABD/Kanada boş. Kaynak: `docs/PROJECT_ROADMAP_FROM_2026_08_20.md`
2. **1 hafta gerçek müşteri verisiyle kullanım** — veri kalitesi kuyruğunu gerçek
   veriyle döndürme, Resend bounce/teslim metriklerini izleme.
3. **Google Branding doğrulaması + unlisted YouTube demo videosu** — dış
   yönetişim işi (Google Cloud); hassas kapsam onayı sonrası.
4. **WhatsApp Business** — ertelendi; karar sonrası CRM'e entegrasyon planlanır.
5. **Periyodik bakım** — Dependabot PR'ları düzenli merge (CI yeşilse),
   çeyreklik kabul turu, yedek doğrulama alışkanlığı.

- [Ana proje raporları dizini](docs/PROJECT_REPORT_INDEX.md)
- [Başlangıçtan bugüne proje geçmişi ve güncel durum](docs/PROJECT_HISTORY_AND_CURRENT_STATUS_2026_08_20.md)
- [Güncel ürün ve geliştirme yol haritası](docs/PROJECT_ROADMAP_FROM_2026_08_20.md)
- [Faz 5.7 production kapanış raporu](docs/PHASE_5_7_PRODUCTION_CLOSURE.md)
- [Canlı uygulama](https://abidinyildiz.com)

## Özellikler

- **Akıllı Evrak Seçim Sistemi (Kosmosvize Modeli)**: Müşterinin seyahat aracı, konaklama tipi, mesleği ve çocuk durumuna göre dinamik evrak listeleri üretimi.
- **Kapsamlı Müşteri Yönetimi**: Kişisel bilgiler, pasaport, iletişim geçmişi (arama, e-posta, WhatsApp) ve vize geçmişi takibi.
- **Gelişmiş Başvuru Takibi**: Süreç boyunca durum güncellemeleri, randevu yönetimi, kargo ve sonuçlandırma takibi.
- **Finansal Yönetim**: Vize harcı, ofis hizmet bedeli ve ödeme takibi; bekleyen ödemede son tarih ile gecikme görevi.
- **Rol Bazlı Yetkilendirme**: Yönetici (Admin) ve Danışman erişim yetkileri. Danışmanlar sadece kendi müşterilerini görebilirken yöneticiler tüm sistemi görebilir.
- **Müşteri Portalı (Extranet)**: Süreli bağlantıdan süreç takibi ve private Storage'a imzalı, doğrulamalı evrak yükleme.
- **Audit Log (Sistem Logu)**: Hangi personelin hangi müşteri üzerinde ne zaman değişiklik yaptığının detaylı kaydı.
- **Görev ve Gerçek Bildirimler**: Personel bazlı manuel görevler; randevu, geciken evrak, bekleyen ödeme ve hareketsiz başvuru hatırlatmaları; kişiye özel okundu durumu.
- **Zamanlanmış Operasyonlar**: Vercel Cron ile pasaport, randevu, evrak, ödeme ve hareketsiz başvuru görevlerini kullanıcı sayfa açmadan üretme.
- **Lead Yönetimi**: Kaynak, kampanya, yönlendirme, sorumlu, SLA, mükerrer tespiti ve kontrollü müşteri dönüşümü.
- **Kontrollü KVKK Otomasyonu**: Dry-run adayları, hukuki saklama, yönetici/çift onay, doğrulanmış yedek kapısı ve değiştirilemez audit izi.
- **Takvim ve Dışa Aktarım**: Randevu çakışması/durum geçmişi, isteğe bağlı Google Calendar çift yönlü eşitlemesi, Europe/Istanbul uyumlu ICS ile filtre tutarlı CSV/PDF raporları.
- **Başvuru Süreç Panosu**: Kontrollü durum geçişleri, personel/ülke/tarih/gecikme filtreleri ve atomik audit kaydı.
- **Müşteri Deneyimi**: Kanonik başvuru bilgileri, renkli etiketler, hızlı iletişim/not eylemleri ve birleşik müşteri timeline'ı.
- **Yönetilebilir İletişim**: İzin denetimli e-posta outbox'ı, Resend teslim/bounce webhook'u, WhatsApp/e-posta şablonları ve audit izi.
- **Kontrollü Müşteri Portalı**: Süreli bağlantı yenileme/iptal akışı ile başvuru, evrak, randevu, ödeme ve geçmiş özeti.
- **KVKK ve Veri Yaşam Döngüsü**: Sürümlü aydınlatma/rıza kanıtı, ilgili kişi talepleri, veri paketi, saklama kilidi, Storage temizliği ve kontrollü anonimleştirme.
- **İzleme ve İş Sürekliliği**: Request ID ile yapılandırılmış güvenli loglar, liveness/readiness kontrolleri, admin operasyon uyarıları, doğrulanmış yedek geçmişi ve izole geri yükleme tatbikatı.
- **Hesap Güvenliği**: Rol bazlı TOTP/MFA, giriş kilidi, oturum görünürlüğü ve diğer cihaz oturumlarını sonlandırma.
- **Kişisel Veri Maskeleme**: Liste, arama ve özet ekranlarında telefon, e-posta ve pasaport bilgilerinin sınırlı gösterimi.
- **Operasyon Dashboard'u**: Aylık başvuru/onay/red/gelir metrikleri ile süresi dolan veya altı ay içinde bitecek pasaport uyarıları.
- **Yedekleme ve Dışa Aktarma**: SHA-256 ile doğrulanan sürümlü veritabanı JSON yedeği, private Storage envanteri ve müşteri verilerini CSV olarak dışa aktarabilme. Storage belge binary'leri continuity paketinde ayrıca saklanır.

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
# CRON_SECRET=...                     # yalnızca sunucu, en az 32 bayt
# BACKUP_ENCRYPTION_KEY=...           # yalnızca sunucu, 32 bayt base64
# MESSAGE_PROVIDER=resend             # production e-posta sağlayıcısı
# RESEND_API_KEY=...                  # yalnızca Vercel server secret
# EMAIL_FROM=...                      # Resend'de doğrulanmış gönderici
# NEXT_PUBLIC_APP_URL=https://abidinyildiz.com
# GOOGLE_CALENDAR_CLIENT_SECRET=...   # yalnızca Vercel server secret
# CALENDAR_TOKEN_ENCRYPTION_KEY=...   # yalnızca Vercel server secret, 32 bayt base64
# ENABLE_ATOMIC_RESTORE=false          # normal çalışma için kapalı

# Geliştirme sunucusunu başlatın
npm run dev
```

## Güvenlik notları

- `SUPABASE_SERVICE_ROLE_KEY`, webhook, cron ve yedek anahtarları hiçbir zaman `NEXT_PUBLIC_` önekiyle tanımlanmamalıdır.
- Müşteri evrakları private Supabase Storage bucket'ında tutulur ve uygulama kısa süreli imzalı bağlantı üretir.
- Google ile giriş yalnızca mevcut ve aktif `staff.user_id` kaydıyla eşleşen hesapları kabul eder; rol bazlı MFA politikası sosyal girişten sonra da uygulanır.
- Google ile giriş ve Google Takvim izinleri ayrı OAuth akışlarıdır. Takvim tokenları yalnız sunucuda şifreli tutulur.
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
npm run restore:drill

# Yerel Supabase çalışırken; ilk kullanımda `npx playwright install chromium`
npm run test:e2e:local
```

Pull request ve `main` push'larında GitHub Actions; uygulama, veritabanı ve
Chromium smoke testlerini ayrı kalite kapıları olarak çalıştırır.

Faz 1 staging/production adımları ve geri dönüş planı
`docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` dosyasındadır.

## Proje raporları ve teknik yol haritası

Başlangıçtan bugüne proje geçmişi, doğrulanmış güncel durum ve sıradaki işlerin
tek giriş noktası `docs/PROJECT_REPORT_INDEX.md` dosyasıdır. 26 Temmuz 2026
tarihli `docs/TECHNICAL_AUDIT_AND_ROADMAP.md` tarihsel teknik inceleme olarak
korunur; güncel plan yerine kullanılmaz.

### Faz durumu

| Faz | Durum | Rapor |
|---|---|---|
| Faz 0 — Güvenlik ve veri koruma | Production'a uygulandı ve doğrulandı | `docs/PHASE_0_DEPLOYMENT_RUNBOOK.md` |
| Faz 1 — Veritabanı standardizasyonu | Production'a uygulandı ve doğrulandı | `docs/PHASE_1_IMPLEMENTATION_REPORT.md` |
| Faz 2 — Stabilizasyon ve kalite | Tamamlandı | `docs/PHASE_2_IMPLEMENTATION_REPORT.md` |
| Faz 3 — İç CRM ürünleştirme | Tamamlandı | `docs/PHASE_3_PLAN.md` |
| Faz 4 — Operasyon otomasyonu ve CRM iyileştirmeleri | Tamamlandı; gerçek admin MFA kabulü, oturum kapatma, production doğrulaması ve kapanış kaydı tamamlandı. Gerçek mesaj sağlayıcısı Faz 5.2'ye ertelendi. | `docs/PHASE_5_0_CLOSURE_REPORT.md` |
| Faz 5 — Veri kalitesi, gerçek iletişim ve operasyon geliştirmeleri | 5.0–5.7 production kabulünden geçti. Veri kalite kuyruğu, şirket iletişim doğrulaması, kaynaklı ülke/evrak kataloğu, Resend gerçek teslimi, Google ile giriş, Google Takvim gidiş-dönüş kabulü ve public doğrulama sayfaları canlıdır. Takvim kapsamı `calendar.events.owned` olarak daraltılmıştır. Google yayıncı/hassas kapsam doğrulaması dış yönetişim işi olarak devam eder; WhatsApp Business ertelendi. | `docs/PHASE_5_PLAN.md`, `docs/PHASE_5_6_LIVE_ACCEPTANCE.md`, `docs/PHASE_5_7_PRODUCTION_CLOSURE.md` |

Faz 3 alt aşama takibi:

- **Faz 3.1 — Tamamlandı:** production hazırlığı, güvenli migration ve yayın doğrulaması
- **Faz 3.2 — Tamamlandı:** tek şirket arayüzü, şema temizliği ve production doğrulaması
- **Acil Paket H2 — Tamamlandı:** müşteri soft delete, Arşiv, kontrollü kalıcı silme ve production doğrulaması (`docs/H2_CUSTOMER_ARCHIVE_REPORT.md`)
- **Faz 3.3 — Tamamlandı:** 3.3.1–3.3.7 bitti; görevler, kişisel bildirimler, otomatik hatırlatmalar, production migration ve canlı doğrulama tamamlandı (`docs/PHASE_3_3_IMPLEMENTATION_REPORT.md`)
- **Faz 3.4 — Tamamlandı:** 3.4.1–3.4.6 bitti; süreç panosu, başvuru profil alanları, etiketler, dashboard metrikleri, hızlı eylemler, timeline, production migration ve canlı doğrulama tamamlandı (`docs/PHASE_3_4_IMPLEMENTATION_REPORT.md`)
- **Faz 3.5 — Tamamlandı:** 3.5.1–3.5.6 bitti; yönetilebilir iletişim, durum/audit kaydı, kontrollü portal, production migration ve canlı doğrulama tamamlandı (`docs/PHASE_3_5_IMPLEMENTATION_REPORT.md`)
- **Faz 3.6 — Tamamlandı:** 3.6.1–3.6.6 bitti; KVKK kayıtları, veri yaşam döngüsü, kalite kapıları, production migration ve canlı doğrulama tamamlandı (`docs/PHASE_3_6_IMPLEMENTATION_REPORT.md`)
- **Faz 3.7 — Tamamlandı:** 3.7.1–3.7.6 bitti; yapılandırılmış loglar, health kontrolleri, operasyonel uyarılar, doğrulanmış DB/Storage yedek takibi, izole restore tatbikatı, production migration ve canlı doğrulama tamamlandı (`docs/PHASE_3_7_IMPLEMENTATION_REPORT.md`)
- **Faz 3.8 — Tamamlandı:** 3.8.1–3.8.8 bitti; kabul matrisi, rol ve kritik
  akış E2E'leri, responsive/erişilebilirlik/performans bütçeleri, migration,
  RLS, audit, dependency, UAT, restore/rollback ve production kapanış kapıları
  tamamlandı (`docs/PHASE_3_8_IMPLEMENTATION_REPORT.md`,
  `docs/PHASE_3_8_RELEASE_AND_CLOSURE.md`)

Ayrıntılı kapsam ve kabul ölçütleri `docs/PHASE_3_PLAN.md`; Faz 3.1 ve 3.2
kanıtları ilgili uygulama raporlarındadır. Bir aşama
staging/production kanıtı tamamlanmadan `Tamamlandı` olarak işaretlenmez.

Faz 4 bütünüyle kapanmıştır. Gerçek admin TOTP/MFA kabulü ve diğer oturumları
sonlandırma testi 2 Ağustos 2026'da tamamlanmış; issue #34, #35 ve #39 ile Faz
4 milestone'u kanıtlarıyla kapatılmıştır. Faz 4.5'te ertelenen gerçek e-posta
sağlayıcısı Faz 5.2'de Resend ile production'a alınmış ve canlı delivery
webhook'u 19 Ağustos 2026'da doğrulanmıştır. Kapanış kaydı
`docs/PHASE_5_0_CLOSURE_REPORT.md`, güncel ürün sırası
`docs/PROJECT_ROADMAP_FROM_2026_08_20.md` dosyasındadır. SaaS/tenant ve
abonelik özellikleri halen kapsam dışıdır.

### Production hotfix kayıtları

- 21 Temmuz 2026 — Staff/Auth bağlantısı ve RLS müşteri görünürlüğü:
  `docs/PRODUCTION_INCIDENT_20260721_STAFF_AUTH_LINK.md`

## Sürüm Notları (Changelog)
Geliştirme geçmişi ve sürüm notları için `CHANGELOG.md` dosyasına bakabilirsiniz.
