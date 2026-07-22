# Faz 3.4 — Başvuru ve Müşteri Operasyonu Uygulama Raporu

Tarih: 22 Temmuz 2026
Dal: `phase-3.4/application-board`
Durum: **Uygulama tamamlandı — production doğrulaması bekliyor**

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
- **3.4.6 devam ediyor:** GitHub kalite kapıları, production migration, Vercel
  yayını ve canlı smoke doğrulaması.

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
| pgTAP | Geçti, 117/117 |
| ESLint | Geçti |
| TypeScript | Geçti |
| Node uygulama/güvenlik testleri | Geçti, 23/23 |
| Faz 3.4 birleşik Playwright akışı | Geçti, 1/1 |
| Tüm Playwright paketi | Geçti, 8/8 |
| Production dependency audit | Geçti, 0 açık |
| Next.js production build | Geçti |

## Production kontrol listesi

- [ ] Migration öncesi şifreli veritabanı, rol ve Storage yedeği
- [ ] Doğru CRM projesi (`zrxdwnshegihakqfszfh`) için migration preflight
- [ ] `202607220003`–`202607220006` migration'larının uygulanması
- [ ] Production veritabanı lint ve şema/veri koruma kontrolü
- [ ] Vercel production dağıtımı ve `abidinyildiz.com` alias kontrolü
- [ ] Oturumlu süreç panosu, edit/detay, etiket, dashboard, hızlı not ve timeline smoke testi
- [ ] Geçici Auth/personel/müşteri/test verilerinin tamamen temizlenmesi

Production kanıtları tamamlanmadan Faz 3.4 final olarak kapatılmayacaktır.
