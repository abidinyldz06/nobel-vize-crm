# Faz 5.4 — Kaynak İzlenebilir Ülke/Vize Evrak Kataloğu

Tarih: 6 Ağustos 2026

Durum: Tamamlandı ve production'da doğrulandı. PR #58 kontrollü squash merge
ile ana dala alındı; ana dal CI, production migration, sağlık uçları ve canlı
katalog arayüzü kabulü geçti.

## Amaç

Mevcut ülke/vize kurallarını kaynağı belirsiz statik listeler olmaktan
çıkarıp resmî ve ikincil kaynakları, son kontrol tarihini ve yeniden kontrol
tarihini taşıyan denetlenebilir bir kataloğa dönüştürmek.

Bu faz Resend, Google Calendar, WhatsApp veya Outlook sağlayıcılarını
etkinleştirmez.

## Başlangıç envanteri

Production'da yapılan salt okunur denetimde:

- 20 aktif ülke, 72 evrak kuralı ve 813 evrak satırı vardı;
- kuralların hiçbirinde kaynak veya kontrol tarihi tutulmuyordu;
- 72 kuralın tamamı genel kuraldı; profil alanlarına özel kural yoktu;
- aktif yedi başvurunun beşi Fransa turistik, biri Fransa öğrenci ve biri
  Almanya iş kategorisindeydi.

Bu nedenle ilk içerik paketi production kullanım önceliğine göre Almanya iş,
Fransa turistik ve Fransa öğrenci kayıtlarına ayrıldı.

## Uygulanan katalog temeli

- Her kural birden fazla kaynak taşıyabilir.
- Kaynak türü `official` (konsolosluk/resmî başvuru sistemi) veya `secondary`
  (danışmanlık/karşılaştırma kaynağı) olarak açıkça saklanır.
- Kaynak başlığı, HTTPS adresi, kontrol zamanı ve yeniden kontrol tarihi
  tutulur.
- Arayüzde şu durumlar ayrı rozetlerle gösterilir: resmî kaynak doğrulandı,
  yeniden kontrol gerekli, ikincil kaynak, kontrol bekliyor ve kaynak yok.
- İçerik değiştiğinde yönetici kaynakları yeniden doğrulamazsa eski doğrulama
  otomatik kaldırılır.
- Kural ekleme, güncelleme ve silme yalnız yönetici RPC'si üzerinden yapılır;
  doğrudan tarayıcı yazımı kapalıdır ve tüm işlemler audit log'a yazılır.

## İlk doğrulanmış içerik paketi

### Almanya — İş seyahati

Genel, mesleki ve seyahat amacına bağlı belgeler aşağıdaki resmî sayfalara
göre yeniden düzenlendi:

- [Almanya Dışişleri Bakanlığı — İş Seyahati Vizesi](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768816-2768816)
- [Almanya Dışişleri Bakanlığı — Schengen Vizesi Genel Bilgiler](https://tuerkei.diplo.de/tr-tr/service/05-visaeinreise/2768812-2768812)

Pasaport koşulları, tek biyometrik fotoğraf, sağlık sigortası, seyahat ve
konaklama kanıtı, nüfus kayıt örneği, finansal kanıtlar, Alman şirket daveti
ve sicil kaydı zorunlu temel olarak kaydedildi. Çalışan, firma sahibi,
çiftçi, öğrenci, Türk vatandaşı olmayan başvuru sahibi, fuar ve teknik servis
durumlarına bağlı belgeler açıklamalı opsiyonel satırlardır.

[3GEN Vize Almanya sayfası](https://3genvize.com/ulkeler/almanya-vizesi/)
profil kapsamını karşılaştırmak için ikincil kaynak olarak tutulur. Resmî
kaynakla çelişen ayrıntıda resmî kaynak esas alınır.

### Fransa — Turistik ve öğrenci

[France-Visas turistik kısa kalış](https://france-visas.gouv.fr/en/web/france-visas/sejour-touristique-de-moins-de-3-mois)
ve [France-Visas öğrenci](https://www.france-visas.gouv.fr/en/etudiant)
sayfaları kesin evrak listesinin ülke, uyruk ve başvuru profiline göre Visa
Assistant tarafından üretildiğini belirtir.

Bu nedenle mevcut Fransa evrakları tahminle değiştirilmedi. Resmî France-Visas
ve [3GEN Vize Fransa](https://3genvize.com/ulkeler/fransa-vizesi/) bağlantıları
inceleme kaynağı olarak eklendi; kategoriye özel Visa Assistant sonucu
karşılaştırılana kadar kayıtlar “kaynak kontrolü bekliyor” durumundadır.

## Katalog genişletme sırası

1. Production'da kullanılan Fransa turistik ve öğrenci profilleri için
   France-Visas Assistant çıktısını kaydet ve mevcut listeyle karşılaştır.
2. Almanya turistik, aile ziyareti ve öğrenci listelerini resmî kategori
   sayfalarıyla doğrula.
3. Kalan Schengen ülkelerini gerçek başvuru hacmine göre sırala; her paket
   için resmî kaynak + isteğe bağlı ikincil karşılaştırma uygula.
4. ABD, İngiltere ve Kanada'yı Schengen ortak listesinden bağımsız olarak
   kendi resmî başvuru sistemleriyle doğrula.

Yaklaşık 285 profil kombinasyonu otomatik kopyalanmaz. Profil özel belgeleri
önce kaynakla doğrulanır; kopya listeler yerine mevcut eşleştirici modelinin
genel kural + profil eki desteklemesi ayrı teknik tasarım kararı olarak ele
alınır.

## Kabul kapıları

- migration reset, lint ve pgTAP güvenlik testleri;
- üretilmiş Supabase tiplerinin migration ile birebir eşleşmesi;
- kaynak durumu birim testleri;
- lint, typecheck, birim testleri, production dependency audit ve build;
- yerel tam release doğrulaması;
- GitHub PR kontrolleri, kontrollü merge, ana dal CI;
- production migration sonrası katalog sayfası ve health kontrolü.

## Yerel doğrulama sonucu

- lint ve TypeScript kontrolü geçti;
- 73 uygulama/güvenlik testi geçti;
- migration zinciri sıfırdan kuruldu, şema lint temiz ve 395 pgTAP testi
  geçti;
- üretilmiş Supabase tipleri migration şemasıyla eşleşti;
- production bağımlılık denetimi sıfır yüksek seviye açıkla geçti;
- production build tamamlandı;
- izole backup/restore tatbikatı başarıyla rollback edildi;
- kaynak ekleme/doğrulama senaryosu dahil 29 Chromium testi geçti.

## GitHub ve production kapanışı

- Uygulama commit'i `bf368d4` GitHub'a gönderildi ve PR #58 üzerinden
  incelendi.
- PR Quality Gates içinde application, database ve browser işleri ile Vercel
  önizlemesi başarılı oldu.
- PR #58, beklenen baş commit doğrulandıktan sonra kontrollü squash merge ile
  birleştirildi; ana dal merge commit'i `af9d971` oldu.
- Ana dal Quality Gates çalışması `31077706481` içinde application, database
  ve browser işleri yeniden başarıyla tamamlandı; Vercel production dağıtımı
  başarılı oldu.
- `202608060001_phase54_country_rule_catalog.sql` production Supabase'e
  uygulandı ve yerel/uzak migration geçmişinin eşit olduğu doğrulandı.
- `/api/health/live`, `/api/health/ready` ve `/` uçları HTTP 200 döndürdü.
- Production veri doğrulamasında Almanya'nın iki resmî kaynağı ve 3GEN ikincil
  kaynağı; Fransa'nın resmî kaynakları ve iki kategoriye eklenmiş 3GEN
  referansları bulundu.
- Canlı yönetici arayüzünde Almanya İş kuralı 22 evrakla “Resmî kaynak
  doğrulandı”; Fransa Turistik ve Öğrenci kuralları ise bilinçli olarak
  “Kaynak kontrolü bekliyor” durumunda görüntülendi.
