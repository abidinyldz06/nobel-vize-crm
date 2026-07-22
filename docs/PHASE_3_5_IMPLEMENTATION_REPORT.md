# Faz 3.5 — Müşteri İletişimi ve Portal Uygulama Raporu

Tarih: 22 Temmuz 2026  
Durum: Yerel uygulama ve doğrulama tamamlandı; production yayını bekliyor

## Amaç

Müşteri iletişimini sabit metinlerden çıkarıp yönetilebilir, kayıtlı ve denetlenebilir
bir akışa taşımak; portal bağlantısının yaşam döngüsünü kontrol altına almak ve
müşterinin portalda gördüğü operasyon özetini iyileştirmek.

## 3.5.1 bitti — Yönetilebilir mesaj şablonları

- `message_templates` tablosu ve personel okuma RLS politikası eklendi.
- WhatsApp ve e-posta için 11 hazır sistem şablonu oluşturuldu.
- Şablon ekleme/düzenleme/pasifleştirme admin kontrollü RPC'ye taşındı.
- Ayarlar ekranına kanal, konu, içerik, değişken ve aktiflik yönetimi eklendi.
- Mesaj şablonları sürümlü JSON backup/restore kapsamına alındı.

## 3.5.2 bitti — Ortak mesaj hazırlayıcı

- Müşteri detayına WhatsApp ve e-posta için ortak mesaj hazırlayıcı eklendi.
- Ad, ülke, başvuru durumu, eksik evrak, randevu, kalan ücret, portal ve şirket
  alanları kontrollü değişkenler olarak tanımlandı.
- Tanınmayan değişkenlerin kaydedilmesi engellendi; eksik değerler güvenli biçimde
  boş metne dönüştürüldü.
- Sabit WhatsApp şablon bileşeni kaldırıldı.

## 3.5.3 bitti — İletişim durumu ve audit izi

- İletişim kayıtlarına şablon, alıcı, durum, hata nedeni ve gönderim zamanı eklendi.
- Doğrudan tablo yazmaları kapatıldı; kayıt ve durum değişiklikleri kontrollü
  RPC'lere taşındı.
- `kaydedildi`, `hazirlandi`, `gonderildi` ve `basarisiz` durumları tanımlandı.
- Hazırlama, gönderildi işaretleme ve başarısızlık işlemleri personel adıyla audit
  kaydına bağlandı.
- Alıcısı bulunmayan iletişim denemeleri hata nedeni ile kaydediliyor.
- Harici WhatsApp/e-posta sağlayıcısı bulunmadığı için uygulama yalnız ilgili
  istemciyi açıyor; teslimat personelin doğrulamasıyla işaretleniyor.

## 3.5.4 bitti — Portal erişim yaşam döngüsü

- Portal bağlantısına etkinlik, son kullanma ve son erişim alanları eklendi.
- Bağlantı yenileme, devre dışı bırakma ve yeniden açma kontrollü RPC'lere taşındı.
- Yeni bağlantılar varsayılan 90 günlük süreyle oluşturuluyor.
- Süresi dolmuş veya kapatılmış bağlantılar portal verisine erişemiyor.
- Portal paylaşımı da hazırlanmış iletişim olarak geçmişe kaydediliyor.

## 3.5.5 bitti — Portal içeriği

- Başvuru durumu, evrak ilerlemesi, randevu ve ödeme özeti korunup tutarlı hale getirildi.
- Geçmiş başvurular kronolojik bölüm olarak eklendi.
- Sabit iletişim bilgileri kaldırıldı; şirket adı, e-posta ve telefon ayarlardan okunuyor.
- Geçerli portal erişimleri son erişim zamanını güncelliyor.

## 3.5.6 devam ediyor — Yayın ve doğrulama

Yerel doğrulama sonuçları:

- ESLint: geçti
- TypeScript: geçti
- Uygulama testleri: 27/27 geçti
- Dependency audit: 0 yüksek önem ve üzeri bulgu
- Production build: geçti
- Veritabanı lint: 0 bulgu
- pgTAP: 148/148 geçti
- Playwright: 9/9 geçti

Production öncesi kalan işler:

1. GitHub kalite kapılarını çalıştırmak ve değişiklikleri `main` dalına almak.
2. Güncel şifreli production yedeğini oluşturup geri açılabilirliğini doğrulamak.
3. `202607220008` ve `202607220009` migration'larını kontrollü uygulamak.
4. Vercel production yayınını ve canlı Faz 3.5 kullanıcı akışını doğrulamak.
5. Veri sayımlarını ve migration hizasını tekrar kontrol edip raporu kapatmak.

## Güvenlik kararları

- Şablon değişiklikleri yalnız admin yetkisindedir.
- İletişim ve portal mutasyonlarında doğrudan tablo yazımı yerine güvenlik tanımlı
  kontrollü iş akışları kullanılır.
- Portal token'ı anonim RLS politikası açmaz; portal okuması sınırlı sunucu sorgusudur.
- Uygulama, harici sağlayıcı kanıtı olmadan bir mesajı teslim edilmiş saymaz.
