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

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons, Recharts
- **Backend & Database**: Supabase (PostgreSQL), Supabase Auth, Row Level Security (RLS)
- **Deployment**: Vercel

## Kurulum ve Çalıştırma

Projeyi lokalde çalıştırmak için:

```bash
# Bağımlılıkları yükleyin
npm install

# .env.local dosyasını ayarlayın
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Geliştirme sunucusunu başlatın
npm run dev
```

## Sürüm Notları (Changelog)
Geliştirme geçmişi ve sürüm notları için `CHANGELOG.md` dosyasına bakabilirsiniz.
