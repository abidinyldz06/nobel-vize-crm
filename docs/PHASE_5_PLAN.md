# Faz 5 — Veri Kalitesi, Gerçek İletişim ve Operasyon Geliştirmeleri

Tarih: 29 Temmuz 2026

Durum: Yalnız Faz 5.0 yürütülüyor. Faz 5.1, 5.2 ve 5.3 planlanmıştır; bu
belge sonraki iş sırasını kaydeder, henüz bu paketlerde kod veya production
taahhüdü oluşturmaz.

## 5.0 — Temizlik ve Faz 4 kapanışı

- Faz 4 production kanıtlarını güncel ve doğrulanabilir halde toplamak.
- Dependabot Actions güncellemelerini birer birer kalite kapılarından sonra
  birleştirmek.
- Gerçek admin MFA/TOTP enrollment ve diğer oturumları kapatma kabulünü
  gerçekleştirmek.
- Sağlayıcı kararını açıkça kaydetmek, Faz 4 issue ve milestone kapanışını
  yalnız kanıtlar tamamlandığında yapmak.
- Silinmesi istenen 15 kopya için kesin dosya/nesne listesi olmadan silme
  işlemi yapmamak.

## 5.1 — Veri kalitesi ve ülke kuralları

- Eksik müşteri ve başvuru alanları için sorumlu atanabilen tamamlama kuyruğu.
- Doğrulanmış şirket telefonu ve e-postası için kontrollü ayar akışı.
- Ülke/vize evrak kuralında kaynak, son güncelleme ve geçerlilik tarihi.
- Süresi geçmiş kurallarda yönetici uyarısı ile eksik/çelişkili kayıtlar için
  veri kalitesi paneli.

## 5.2 — Gerçek iletişim sistemi

- Önce gerçek e-posta gönderimi, doğrulanmış gönderici alan adı, şablonlar,
  teslim/başarısız webhookları, izin/ret denetimi ve sandbox/retry kabulü.
- WhatsApp Business ancak e-posta paketi tamamlanıp ayrı ürün kararı verildikten
  sonra değerlendirilir.

## 5.3 — Operasyon geliştirmeleri

- Google veya Outlook ile iki yönlü takvim senkronizasyonu.
- Portal üzerinden güvenli evrak yükleme, süreç/eksik evrak görünürlüğü.
- Danışman kapasite ve iş yükü planlama ile tahsilat/geciken ödeme takibi.
