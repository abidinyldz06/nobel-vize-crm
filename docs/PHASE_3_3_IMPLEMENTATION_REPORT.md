# Faz 3.3 — Görev ve Gerçek Bildirim Sistemi Uygulama Raporu

Tarih: 22 Temmuz 2026
Dal: `phase-3.3/tasks-notifications`
Durum: **Uygulama ve yerel doğrulama tamamlandı — production geçişi bekliyor**

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
- **3.3.7 bekliyor:** GitHub kalite kapıları, production migration, Vercel yayını
  ve production smoke doğrulaması.

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

## Production kabul ölçütleri

Faz 3.3 ancak aşağıdaki maddeler tamamlanınca bütünüyle `Tamamlandı` olarak
işaretlenecektir:

- GitHub application, database ve browser kontrolleri geçmeli.
- Migration öncesi production yedeği ve şema/veri ön kontrolü alınmalı.
- `202607220002_phase3_tasks_notifications.sql` doğru CRM Supabase projesine
  uygulanmalı ve migration kaydı doğrulanmalı.
- `tasks` ve `notifications` RLS/policy/RPC yapısı production'da doğrulanmalı.
- Vercel production yayını `Ready` olmalı.
- `abidinyildiz.com` üzerinde giriş, görev ekranı ve bildirim merkezi smoke
  kontrolü geçmeli.
