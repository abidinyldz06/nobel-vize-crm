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

Faz 1 staging/production adımları ve geri dönüş planı
`docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` dosyasındadır.

## Teknik yol haritası

Güncel güvenlik incelemesi ve faz planı için `docs/TECHNICAL_AUDIT_AND_ROADMAP.md` dosyasına bakın.

## Sürüm Notları (Changelog)
Geliştirme geçmişi ve sürüm notları için `CHANGELOG.md` dosyasına bakabilirsiniz.
