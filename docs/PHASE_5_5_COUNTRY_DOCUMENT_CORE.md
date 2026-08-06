# Faz 5.5 — Ülke ve Evrak Omurgası

Tarih: 6 Ağustos 2026

Durum: Uygulama, kaynak matrisi ve yerel toplu doğrulama tamamlandı; GitHub ve
production kapanışı Faz 5.5.4 kapsamında yapılacak.

## Amaç

Ülke/vize evrak kataloğunu tek bir kural seçen statik yapıdan çıkarıp genel
liste ile müşterinin açıkça seçilmiş profil koşullarını birleştiren güvenli bir
omurgaya dönüştürmek. İlk içerik paketi Almanya, Fransa ve İtalya için turistik,
iş, öğrenci ve aile ziyareti kategorilerini kapsar.

Bu faz mesajlaşma, takvim veya başka bir dış sağlayıcıyı etkinleştirmez.

## 5.5.1 — Katmanlı kural eşleştirici

- Genel ülke/kategori kuralı her zaman temel liste olarak alınır.
- Meslek, çocuk durumu ve uyruk yalnız kullanıcı bu alanı seçtiğinde ilgili
  profil ekini etkinleştirir.
- Aynı adlı evraklar tekilleştirilir; zorunlu bir evrak daha sonra opsiyonel
  hale gelemez.
- Yeni başvuruda kullanılan bütün kural kimlikleri uygulamada saklanır.
- Başvuru profili değiştiğinde yeni gereken katalog evrakları eklenir; daha
  önce yüklenmiş veya elle eklenmiş evraklar silinmez.
- Genel kuralı olmayan eski kataloglarda mevcut tek-kural davranışı güvenli
  fallback olarak korunur.

## 5.5.2 — Kaynak matrisi

| Ülke | Turistik | İş | Öğrenci | Aile ziyareti |
|---|---|---|---|---|
| Almanya | Resmî doğrulandı | Resmî doğrulandı | Resmî kısa öğrenci gezisi listesi doğrulandı | Resmî doğrulandı |
| Fransa | Visa Assistant sonucu bekliyor | Visa Assistant sonucu bekliyor | Visa Assistant sonucu bekliyor | Visa Assistant sonucu bekliyor |
| İtalya | 2026 resmî PDF doğrulandı | Güncel doğrudan ticari kontrol listesi bekliyor | Resmî genel eğitim listesi doğrulandı | 2026 resmî PDF doğrulandı |

### Almanya

- [Turistik Amaçlı Vize](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768822-2768822)
- [İş Seyahati Vizesi](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768816-2768816)
- [Öğrenci Gezileri İçin Vize](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768826-2768826)
- [Ziyaret Amaçlı Vize](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768820-2768820)
- [Schengen Vizesi Genel Bilgiler](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812)
- [3GEN Vize — Almanya](https://3genvize.com/ulkeler/almanya-vizesi/)

`ogrenci` kategorisi Almanya için yalnız 90 güne kadar öğrenci/okul gezisini
ifade eder. Üniversite, dil kursu ve diğer uzun süreli eğitimler ulusal vize
akışıdır ve bu listeye karıştırılmamıştır.

### Fransa

- [Tourism and private stay](https://www.france-visas.gouv.fr/en/tourisme-et-sejour-prive)
- [Professional purpose](https://france-visas.gouv.fr/en/web/france-visas/motif-professionnel)
- [Student](https://www.france-visas.gouv.fr/en/etudiant)
- [Family purpose](https://france-visas.gouv.fr/en/web/france-visas/motif-familial)
- [Visa Assistant](https://france-visas.gouv.fr/en/web/france-visas/assistant-visa)
- [3GEN Vize — Fransa](https://3genvize.com/ulkeler/fransa-vizesi/)

France-Visas kesin belge listesini ikamet, uyruk, süre ve başvuru amacına göre
Visa Assistant içinde üretir. Bu nedenle Fransa listeleri kullanışlı bir
çalışma taslağı olarak genişletilmiş, fakat hiçbirine resmî doğrulama tarihi
yazılmamıştır. Profil çıktısı alınana kadar arayüzde kontrol bekliyor görünür.

### İtalya

- [Tourism, Family and Friends — 2026](https://consistanbul.esteri.it/wp-content/uploads/2026/05/10_Tourism.pdf)
- [Generic Study Checklist](https://consistanbul.esteri.it/wp-content/uploads/2024/05/STUDIO_GEN-C_20.05.2024.pdf)
- [Study in Italy / Universitaly](https://consistanbul.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/studiare-in-italia/universita/)
- [Vize Formları ve Belgeler](https://consistanbul.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/modelli-e-modulistica/)
- [3GEN Vize — İtalya](https://3genvize.com/ulkeler/italya-vizesi/)

İtalya `aile_ziyareti`, kısa süreli aile/arkadaş ziyaretidir. Aile birleşimi
ve yerleşme amaçlı ulusal vize belgeleri bu kategoriye eklenmemiştir. Ticari
liste güncel doğrudan İstanbul kontrol listesiyle karşılaştırılana kadar
kontrol bekliyor statüsündedir.

## 5.5.3 — İlk içerik paketi

- 3 ülke × 4 kategori için 12 temel liste güncellenir veya eksikse oluşturulur.
- Meslek (`calisan`, `memur`, `emekli`, `ogrenci`, `sirket_sahibi`, `issiz`),
  çocuklu seyahat ve Türk vatandaşı olmayan profil eklerinden 91 koşullu kural
  eklenir.
- Almanya kısa öğrenci gezisinde ilgisiz meslek profilleri bilinçli olarak
  üretilmez.
- Migration başka ülkelere veya farklı seyahat/konaklama profillerine ait elle
  oluşturulmuş kuralları silmez.
- 3GEN yalnız profil kapsamını karşılaştırmak için ikincil kaynaktır. Resmî
  kaynakla çelişen süre, bakiye, fotoğraf adedi veya belge güncelliği sisteme
  kesin gereksinim olarak taşınmaz.

## 5.5.4 — Kapanış kapıları

Tek toplu doğrulamada:

1. migration zinciri sıfırdan kurulur, DB lint ve pgTAP çalıştırılır;
2. Supabase tipleri yeniden üretilir ve şemayla eşitliği kontrol edilir;
3. lint, TypeScript, birim testleri, bağımlılık denetimi ve production build
   çalıştırılır;
4. tarayıcı testlerinde boş profil, çoklu profil eki ve kaynak statüleri kabul
   edilir;
5. yalnız bütün kapılar yeşilse commit/push/PR yapılır;
6. PR kontrolleri sonrası kontrollü merge, ana dal CI, production migration ve
   canlı arayüz ayrı ayrı doğrulanır.

Yerel kapanışta lint ve TypeScript kontrolü, 77 birim/güvenlik testi, 431
pgTAP testi, production bağımlılık denetimi, production build, izole restore
tatbikatı ve 30 Chromium senaryosu başarıyla tamamlandı.

## Sonraki içerik sırası

Faz 5.5 kapandıktan sonra öncelik, gerçek başvuru hacmine göre diğer Schengen
ülkelerine aynı kaynak + profil eki modelini uygulamaktır. Fransa Visa Assistant
çıktıları ve İtalya ticari güncel kontrol listesi ayrıca doğrulama kuyruğunda
kalır; bu eksikler tamamlanmadan ilgili kayıtlar “resmî doğrulandı” yapılmaz.
