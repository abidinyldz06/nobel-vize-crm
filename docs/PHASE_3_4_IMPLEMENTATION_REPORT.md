# Faz 3.4 — Başvuru ve Müşteri Operasyonu Uygulama Raporu

Tarih: 22 Temmuz 2026
Dal: `phase-3.4/application-board`
Durum: **Tamamlandı ve production'da doğrulandı**

## Aşama durumu

- **3.4.1 bitti:** başvuru süreç panosu; personel, ülke, tarih ve gecikme
  filtreleri; kontrollü tekli/toplu durum geçişleri; zorunlu ret sebebi; atomik
  randevu ve audit akışları tamamlandı.
- **3.4.2 bitti:** `applications` tablosuna kanonik ülke bağlantısı, seyahat
  aracı, konaklama, meslek, çocuk ve uyruk alanları eklendi. Müşteri ve başvuru
  düzenlemesi tek transaction'a taşındı; edit ve detay ekranları tamamlandı.
- **3.4.3 bitti:** RLS korumalı `tags` ve `customer_tags` modeli, VIP/Acil/Reddi
  Var/Premium hazır etiketleri, edit ekranından atama, masaüstü/mobil badge ve
  etiket filtresi tamamlandı.
- **3.4.4 bitti:** role göre kapsamlanan aylık başvuru, onay, red, bekleyen
  başvuru ve tahsil edilmiş gelir kartları; altı aylık pasaport uyarı listesi
  tamamlandı.
- **3.4.5 bitti:** müşteri kartında telefon, WhatsApp, e-posta ve atomik hızlı
  not; başvuru, evrak, ödeme, randevu, iletişim ve notları birleştiren dikey
  timeline tamamlandı.
- **3.4.6 bitti:** GitHub kalite kapıları, şifreli yedek, production migration,
  Vercel yayını ve oturumlu canlı smoke doğrulaması tamamlandı.

## Veri modeli ve güvenlik

- `applications.status` için doğrudan `authenticated` güncelleme yetkisi
  kaldırıldı. Durum değişiklikleri yalnız geçiş matrisini doğrulayan RPC'lerden
  geçer.
- Durum, randevu, müşteri/başvuru düzenleme, etiket ve hızlı not işlemleri
  erişim kontrolü, satır kilidi ve audit kaydıyla yürütülür.
- `country_id` mevcut ülke metinlerinden geriye dönük eşleştirilir; yeni seçimler
  aktif `countries` kaydına foreign key ile bağlıdır.
- Etiket katalog ve ilişkilerinde RLS açıktır. Personel yalnız erişebildiği
  müşterinin etiketini görür/değiştirir.
- Ret durumunda açıklama zorunludur; geçersiz aşama atlaması ve toplu ret
  işlemleri atomik olarak reddedilir.

## Yerel doğrulama

| Kontrol | Sonuç |
|---|---|
| Temiz Supabase migration reset | Geçti |
| Veritabanı lint | Geçti, 0 bulgu |
| pgTAP | Geçti, 118/118 |
| ESLint | Geçti |
| TypeScript | Geçti |
| Node uygulama/güvenlik testleri | Geçti, 23/23 |
| Faz 3.4 birleşik Playwright akışı | Geçti, 1/1 |
| Tüm Playwright paketi | Geçti, 8/8 |
| Production dependency audit | Geçti, 0 açık |
| Next.js production build | Geçti |

## Production kontrol listesi

- [x] Migration öncesi şifreli veritabanı, rol ve Storage yedeği
- [x] Doğru CRM projesi (`zrxdwnshegihakqfszfh`) için migration preflight
- [x] `202607220003`–`202607220007` migration'larının uygulanması
- [x] Production veritabanı lint ve şema/veri koruma kontrolü
- [x] Vercel production dağıtımı ve `abidinyildiz.com` alias kontrolü
- [x] Oturumlu süreç panosu, edit/detay, etiket, dashboard, hızlı not ve timeline smoke testi
- [x] Geçici Auth/personel/müşteri/test verilerinin tamamen temizlenmesi

## Production kanıtları

- Migration öncesi veritabanı, roller ve tek Storage nesnesi repo dışında
  AES-256 ile şifrelenip bağımsız açma/checksum kontrolünden geçirildi.
- CRM production migration zinciri `202607220001`–`202607220007` dahil yerel
  ve uzak veritabanında birebir eşleşiyor; uzak veritabanı lint sonucu 0 bulgu.
- Canlı şemada eski kurulumdan kalan yinelenen `applications.customer_id`
  foreign key kaldırıldı; kanonik `applications_customer_fk` korundu ve ilişki
  sayısı pgTAP ile kilitlendi.
- Production oturum yönlendirmesi, yeni auth çerezinin ayrı dashboard isteğinde
  okunacağı biçimde sağlamlaştırıldı.
- `abidinyildiz.com` güncel Vercel production dağıtımına bağlı ve `READY`.
- Canlı Playwright akışı 1/1 geçti. Test sonunda geçici Auth, personel, müşteri,
  başvuru, ödeme, ülke, etiket ve aktivite kayıtları temizlendi.
- Son veri koruma sayımı: 9 müşteri, 3 personel, 7 başvuru ve 4 hazır etiket.

GitHub kalite kapıları PR #15, PR #16 ve PR #17 üzerinde application, database,
browser ve Vercel kontrollerinin tamamı geçtikten sonra birleştirildi.
