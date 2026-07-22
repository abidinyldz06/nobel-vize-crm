# Faz 3.3 — Görev ve Gerçek Bildirim Sistemi Uygulama Raporu

Tarih: 22 Temmuz 2026
Dal: `phase-3.3/tasks-notifications`
Durum: **Tamamlandı — production migration ve yayın doğrulandı**

## Aşama durumu

- **3.3.1 bitti:** `tasks` ve personel alıcılı `notifications` tabloları,
  indeksler, constraint'ler ve RLS politikaları eklendi.
- **3.3.2 bitti:** manuel görev oluşturma, görev durumu değiştirme, tek bildirimi
  ve tüm bildirimleri okundu işaretleme işlemleri kontrollü RPC'lere taşındı.
- **3.3.3 bitti:** 48 saat içindeki randevular, üç günü geçen zorunlu evraklar,
  üç günü geçen bekleyen ödemeler ve yedi günü geçen hareketsiz başvurular için
  otomatik görev üretimi eklendi.
- **3.3.4 bitti:** Bugün, Geciken, Yaklaşan ve Tamamlanan sekmeleri; manuel görev
  formu ve Başla/Tamamla eylemleri eklendi.
- **3.3.5 bitti:** otomatik görevlerde benzersiz idempotency anahtarları ve
  danışmanın erişemediği müşteriye görev atanmasını engelleyen doğrulamalar eklendi.
- **3.3.6 bitti:** görev ve bildirimler yedekleme/geri yükleme kapsamına alındı;
  eski Faz 2 yedekleriyle geriye uyumluluk korundu; pgTAP, güvenlik ve Playwright
  regresyonları eklendi.
- **3.3.7 bitti:** GitHub kalite kapıları, production migration, Vercel yayını
  ve production smoke doğrulaması tamamlandı.

## Önceki bildirim yapısındaki sorun ve çözüm

Önceki bildirim merkezi `activity_log` kayıtlarını bildirim gibi gösteriyor ve
ortak `is_read` alanını kullanıyordu. Bir personelin okundu işlemi diğer
personellerin durumunu da etkileyebiliyordu. Yeni `notifications` tablosunda her
kayıt bir `recipient_staff_id` sahibidir; RLS yalnız alıcının satırı görmesini,
okundu RPC'leri de yalnız o alıcının kaydını değiştirmesini sağlar.

## Güvenlik ve veri bütünlüğü

- `authenticated` rolü görev/bildirim tablolarına doğrudan yazamaz; yazma
  işlemleri `SECURITY DEFINER` RPC'leri üzerinden doğrulanır.
- Danışman yalnız kendisine görev atayabilir ve yalnız kendi görevlerini
  güncelleyebilir. Yönetici aktif personele görev atayabilir.
- Müşteriye bağlı bir görev, atanan danışmanın o müşteriye erişimi yoksa
  `task_assignee_customer_mismatch` ile reddedilir.
- Otomatik üreticiler arşivlenmiş müşterileri ve pasif personeli dışarıda tutar.
- Her otomatik kaynak için kararlı bir idempotency anahtarı aynı görevin tekrar
  üretilmesini engeller.
- Görev oluşturma tetikleyicisi atanan personel için tam bir kişisel bildirim
  üretir. Restore modu tetikleyici çoğaltmasını önler.

## Yerel doğrulama

| Kontrol | Sonuç |
|---|---|
| Temiz Supabase migration reset | Geçti |
| Veritabanı lint | Geçti, 0 bulgu |
| pgTAP | Geçti, 84/84 |
| ESLint | Geçti |
| TypeScript | Geçti |
| Node testleri | Geçti, 19/19 |
| Faz 3.3 görev/bildirim Playwright testi | Geçti, 1/1 |
| Tüm Playwright paketi | Geçti, 7/7 |

## Production sonucu

| Kontrol | Sonuç |
|---|---|
| PR #13 application kalite kapısı | Geçti |
| PR #13 database kalite kapısı | Geçti |
| PR #13 browser kalite kapısı | Geçti |
| Vercel Preview ve Production | Ready |
| Production migration geçmişi | Geçti, yerel/remote 11/11 |
| Production veritabanı lint | Geçti, 0 bulgu |
| Production görev ve bildirim tabloları | Mevcut |
| Anonim `/api/tasks` ve `/api/notifications` | Beklenen 401 |
| Production giriş–görev–bildirim–tamamlama Playwright akışı | Geçti, 1/1 |
| Geçici Auth/personel/test görevi temizliği | Geçti |

Migration öncesinde public şema/veri, roller ve `documents` Storage nesnelerini
içeren repo dışı AES-256 şifreli yedek oluşturuldu; dosya izni `600` olarak
ayarlandı ve bağımsız açma testi geçti. Anahtar macOS Keychain içinde
`nobel-vize-crm-phase33-backup-20260722` servisiyle saklanıyor.

`202607220002_phase3_tasks_notifications.sql` yalnız doğru `CRM`
(`zrxdwnshegihakqfszfh`) projesine uygulandı. Migration sonrası 9 müşteri ve 3
personel korunmuştur. İlk canlı görev senkronizasyonu mevcut operasyon
kayıtlarından 17 idempotent görev ve bunlara ait 17 kişisel bildirim üretmiştir;
geçici test Auth kullanıcıları ve test personeli tamamen temizlenmiştir.

Vercel production dağıtımı `Ready` durumundadır ve `abidinyildiz.com` alias'ına
bağlıdır. Ana sayfa, korumalı görev rotası, anonim API reddi ve oturumlu
giriş–görev oluşturma–bildirim okuma–görev tamamlama akışları canlıda
doğrulanmıştır.

Bu kanıtlarla **Faz 3.3 tamamlandı**. Sonraki ana çalışma paketi Faz 3.4 başvuru
süreç panosu ve müşteri başvuru bilgileridir.
