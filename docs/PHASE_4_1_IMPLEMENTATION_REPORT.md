# Faz 4.1 — Yanıltıcı Müşteri Puanlamasının Kaldırılması

Tarih: 26 Temmuz 2026

Durum: Release adayı tamamlandı; production migration ve canlı doğrulama
bekliyor.

GitHub kaydı: Faz 4 milestone, issue `#31`

## 1. Ürün kararı

Müşteriye 0–100 arasında puan veren eski sistem gerçek bir yapay zekâ modeli
değildi. Sabit alan kontrollerini puana çeviriyor, buna rağmen arayüzde "AI
Profil Analizi" adıyla sunuluyor ve gerçek veriden üretilmeyen başarı
yüzdeleriyle ilişkilendiriliyordu. Faz 4.1 bu davranışı tamamen kaldırır.

Gerçek başvuru onay/red sonuçları, ülke/vize kırılımları ve evrak
tamamlanma metrikleri korunur. Evrak kuralı seçici yalnız en uygun teknik
kuralı bulur; müşteri hakkında puan veya karar üretmez.

## 2. Uygulama değişiklikleri

- Profil analizi butonu ve modalı silindi.
- Müşteri liste, mobil kart, detay ve CSV çıktılarından skor kaldırıldı.
- Müşteri oluşturma, düzenleme, import, Google Form webhook ve evrak onayı
  artık skor hesaplamıyor veya yazmıyor.
- Rapor ekranındaki sabit `%98`, `%76` ve `%34` değerleri kaldırıldı.
- Yerine seçili dönemin veritabanından hesaplanan tamamlanan, bekleyen ve
  toplam evrak sayıları ile tamamlanma oranı gösteriliyor.

## 3. Veritabanı ve geriye uyumluluk

`202607260005_phase41_remove_profile_score.sql` migration'ı:

- `customers.profile_score` kolonunu ve doğrulama constraint'ini kaldırır;
- müşteri oluşturma, güncelleme ve anonimleştirme RPC'lerini yeni şemayla
  yeniden kurar;
- fonksiyon yetkilerini mevcut güvenlik modeline göre yeniden uygular.

Eski migration dosyaları uygulanmış tarih olarak değiştirilmedi. Eski v2 JSON
yedeklerinde kalan `profile_score` anahtarı PostgreSQL record dönüşümünde
fazladan alan olarak güvenle yok sayılır. Bu davranış pgTAP testi ve izole
restore tatbikatıyla doğrulanır.

## 4. Kalite kanıtları

Release adayı kapanmadan aşağıdaki kontroller çalıştırılır:

- temiz yerel Supabase reset ve tüm migration zinciri;
- schema lint ve pgTAP;
- üretilen TypeScript DB tipinin migration şemasıyla eşleşmesi;
- izole yedekten dönüş tatbikatı;
- lint, typecheck, birim ve güvenlik testleri;
- production dependency audit ve build;
- tam Playwright kabul paketi.

Yerel veritabanı sonucu: schema lint başarılı, `246` pgTAP testi başarılı ve
restore tatbikatı `RESTORE_DRILL_OK` ile tamamlandı.

Tam release adayı sonucu: lint ve typecheck başarılı, `45` Node
uygulama/güvenlik testi başarılı, production bağımlılık ağında açık yok,
production build başarılı ve `22` Playwright kabul testi geçti.

## 5. Production yayın ve geri dönüş

1. Güncel production DB ve private Storage yedeği repo dışında şifrelenir.
2. Migration dry-run yalnız `202607260005` değişikliğini göstermelidir.
3. Yeni uygulama sürümü önce yayınlanır; bu sürüm eski kolona bağımlı değildir.
4. Migration production'a uygulanır ve uzak şema/tip beklentisi doğrulanır.
5. Liveness, readiness, giriş ve kritik müşteri/rapor okumaları kontrol edilir.

Migration kolonu sildiği için geri dönüş yalnız uygulama rollback'i değildir.
Zorunlu geri dönüşte doğrulanmış production yedeğinden `profile_score` kolonu
ve verisi kontrollü bakım penceresinde geri yüklenir. Eski puanlama arayüzünün
yeniden yayınlanması ürün kararı olmadan yapılmaz.
