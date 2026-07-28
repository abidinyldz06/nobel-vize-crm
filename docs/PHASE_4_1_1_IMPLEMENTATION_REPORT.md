# Faz 4.1.1 — Stabilizasyon ve Veri Bütünlüğü

Tarih: 28 Temmuz 2026

Takip: [GitHub Issue #43](https://github.com/abidinyldz06/nobel-vize-crm/issues/43)

Durum: Uygulama paketi ve yerel tam release kapısı tamamlandı; PR/CI ve
production yayını tamamlanmadan issue kapatılmaz.

## 1. Amaç

Faz 4.1 sonrasında yapılan production kontrolünde görülen gerçek kod
hatalarını düzeltmek, eksik veriyi görünür kılmak ve yeni mükerrer müşteri
kayıtlarını veritabanı seviyesinde önlemek.

Bu paket Faz 4.2 zamanlayıcısını uygulamaz. Görevlerin kullanıcı sayfası
açılmadan üretilmesi Faz 4.2 Issue #32 kapsamında kalır.

## 2. Uygulanan değişiklikler

### Evrak kuralı eşleştirme

- Boş profil seçimi artık özel bir kuralı geçersiz saymaz.
- Kullanıcı seçim yaptığında tam eşleşen kural, genel fallback kuralından önce
  gelir.
- Alan boş bırakıldığında genel fallback tercih edilir; yalnız özel kurallar
  varsa bunlar da geçerli aday kalır.
- Eşit adaylarda `created_at` ve `id` ile kararlı sonuç üretilir.
- Aynı sıralama hem React seçicisinde hem atomik PostgreSQL akışında uygulanır.
- Yeni başvurunun ülke, seyahat aracı, konaklama, meslek, çocuk ve uyruk
  alanları aynı transaction içinde kaydedilir.

### Mükerrer müşteri koruması ve veri temizliği

- Telefon yalnız rakamlara, e-posta küçük harfe, pasaport numarası boşluksuz
  büyük harfe normalize edilerek aktif müşteri kaydı aranır.
- Yeni kayıt transaction seviyesinde advisory lock ile korunur; yarışan iki
  istek ikinci bir kayıt üretemez.
- Kullanıcıya kişisel veri açmadan genel bir mükerrer kayıt uyarısı gösterilir.
- Gerçekten farklı kişi olduğu doğrulanırsa açık onay kutusuyla kontrollü
  istisna uygulanabilir.
- Doğrulanmış iki ALPER ORS kaydı için ilişkili başvuru, audit, iletişim,
  görev, bildirim, etiket, aile/vize geçmişi ve KVKK kayıtları kanonik
  müşteriye taşınır.
- Kaynak müşteri hard delete edilmez; portal erişimi kapatılarak arşivlenir ve
  birleştirme audit kaydı yazılır.

### Arayüz ve veri görünürlüğü

- Varsayılan tema açık moda çevrildi.
- Etiket filtresi, yalnız atanmış etiketlerden değil dört hazır etiketi içeren
  ana etiket kataloğundan beslenir.
- Eksik başvuru bilgisine göre müşteri filtresi eklendi.
- Yeni müşteri ve düzenleme ekranında beş başvuru profil alanı zorunludur.
- Görev ekranı ilk veriyi sunucudan alır; istemci yenilemesi başarısız olursa
  mevcut görevleri sıfırlamak yerine görünür hata ve tekrar deneme gösterir.
- Şirket telefonu veya e-postası boşsa örnek placeholder değerlerinin kayıtlı
  bilgi olmadığı açıkça belirtilir.

## 3. Production veri tespiti

- Hazır `VIP`, `Acil`, `Reddi Var` ve `Premium` etiketleri veritabanında
  bulunuyordu; sorun filtre seçeneklerinin yalnız atanmış etiketlerden
  türetilmesiydi.
- Production'da 18 görev vardı; görev ekranındaki sıfır görünümü gerçek veri
  yokluğu değildi.
- Yedi mevcut başvurunun beş profil alanı boştu. Geçmiş veri tahmin edilerek
  doldurulmadı; yeni eksik-bilgi filtresiyle kontrollü tamamlanması sağlandı.
- Şirket e-posta ve telefonu veritabanında boştu. Gerçek değerler ürün sahibi
  tarafından girilmeden placeholder'lar kalıcı veriye çevrilmedi.
- 20 ülke ve 72 evrak kuralı vardı. Kaynağı doğrulanmamış yaklaşık 285 kural
  otomatik üretilmedi; içerik genişletmesi ayrı veri çalışmasıdır.
- Onay/red istatistiklerinin sıfır görünmesi mevcut başvuru sonuçlarıyla
  uyumludur; sahte oran üretilmedi.

## 4. Güvenlik ve geri dönüş

- Production öncesi veritabanı, Auth şeması ve private Storage nesnesini
  içeren şifreli continuity yedeği oluşturuldu ve bağımsız açma/tar
  doğrulamasından geçirildi.
- Mükerrer kayıt migration'ı yalnız önceden doğrulanmış iki UUID, ad ve
  normalize telefon birlikte eşleşirse çalışır.
- Kaynak müşteri arşivde tutulduğu için geri dönüşte ilişkiler yedekten veya
  kontrollü ters migration ile yeniden ayrılabilir.
- Eski atomik fonksiyon private çekirdek olarak korunur; uygulama rolleri
  duplicate ve kural eşleştirme kapısını atlayamaz.

## 5. Kabul kapıları

- Saf kural eşleştirici birim testleri
- Duplicate, override, profil kaydı ve kural seçimi pgTAP testleri
- Mükerrer müşteri uyarısı Playwright senaryosu
- Tema, etiket, görev ve migration release regresyonları
- Tam `npm run release:verify`
- PR GitHub Actions, migration dry-run, production migration ve canlı kontrol

Gerçek şirket iletişim değerleri, eski başvuruların eksik profil verileri ve
ülke kural kataloğunun içerik genişletmesi bu teknik paketin ardından manuel
veri işi olarak açık kalır.
