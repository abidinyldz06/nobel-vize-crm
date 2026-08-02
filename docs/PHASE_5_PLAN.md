# Faz 5 — Veri Kalitesi, Gerçek İletişim ve Operasyon Geliştirmeleri

Son güncelleme: 2 Ağustos 2026

Durum: Faz 5.0, Faz 5.1.1 ve Faz 5.1.2 tamamlandı; Faz 5.1.2 GitHub CI ve
production kabulünden geçti. Faz 5.1.3 şirket iletişim bilgisi doğrulama
paketi geliştirme ve kalite kabulündedir.

## 5.0 — Temizlik ve Faz 4 kapanışı

- Faz 4 production kanıtları güncel ve doğrulanabilir halde toplandı.
- Dependabot Actions güncellemeleri kalite kapılarından sonra sırayla
  birleştirildi.
- 2 Ağustos 2026'da gerçek yönetici MFA/TOTP kabulü tamamlandı: doğrulayıcı
  etkin ve zorunlu olarak görüldü, iki diğer oturum kapatıldı, kullanıcı çıkış
  yapıp yeniden girişten sonra Dashboard'a döndü.
- Sağlayıcı kararı açıkça kaydedildi; Faz 4 issue ve milestone kapanışı kanıt
  tamamlandıktan sonra gerçekleştirildi.
- Adında ` 2` bulunan, kanonik dosyalarla birebir aynı 15 izlenmeyen kopya
  doğrulandı ve kanonik kaynaklar korunarak temizlendi.

## 5.1 — Veri kalitesi ve ülke kuralları

- Eksik müşteri ve başvuru alanları için sorumlu atanabilen tamamlama kuyruğu.
- Doğrulanmış şirket telefonu ve e-postası için kontrollü ayar akışı.
- Ülke/vize evrak kuralında kaynak, son güncelleme ve geçerlilik tarihi.
- Süresi geçmiş kurallarda yönetici uyarısı ile eksik/çelişkili kayıtlar için
  veri kalitesi paneli.

### 5.1.1 — Kapsam ve veri keşfi (tamamlandı)

- Müşteri, başvuru, görev ve ayar şeması incelendi.
- Eksik verinin otomatik doldurulmayacağı; yalnızca sorumluya takip görevi
  açılacağı netleştirildi.

### 5.1.2 — Veri eksikliği görev kuyruğu (tamamlandı ve production'da)

- Yönetici, Görevler ekranındaki Veri Kontrolü ile eksik iletişim, pasaport,
  ülke, vize türü, sorumlu ve başvuru profil bilgilerini tarar.
- Her eksik için tek, idempotent ve yeniden açılabilen görev oluşturulur;
  veri tamamlanınca ilgili görev otomatik tamamlanır.
- Görevler müşterinin aktif sorumlusuna, yoksa yöneticiye düşer. Yönetici
  yalnız bu görevleri aktif personele devredebilir.
- Bu işlem müşteri veya başvuru kaydını değiştirmez, silmez ve dışarıya mesaj
  göndermez.
- Yerel kabulde lint, tip denetimi, 66 birim/güvenlik testi, 339 PostgreSQL/RLS
  testi, geri yükleme tatbikatı ve 27 Chromium senaryosu başarıyla geçti.
- GitHub PR #53 squash merge ile ana dala alındı. Ana dal Quality Gates ve
  production health kontrolleri başarılıdır; migration production ile eşleşir.

### 5.1.3 — Şirket iletişim bilgisi doğrulama (geliştirme ve kalite kabulünde)

- Şirket adı, e-posta ve telefon yalnızca yönetici doğrulama akışından
  güncellenir; doğrudan istemci yazımı kapalıdır.
- Her doğrulamada resmî kaynak bağlantısı, zaman damgası ve doğrulayan
  personel tek şirket kaydında saklanır; sistem loguna denetim olayı eklenir.
- Arayüzde doğrulama tarihi ve kaynak bağlantısı görünür. Bu aşama gerçek
  e-posta/WhatsApp gönderimini etkinleştirmez.

## 5.2 — Gerçek iletişim sistemi

- Önce gerçek e-posta gönderimi, doğrulanmış gönderici alan adı, şablonlar,
  teslim/başarısız webhookları, izin/ret denetimi ve sandbox/retry kabulü.
- WhatsApp Business ancak e-posta paketi tamamlanıp ayrı ürün kararı verildikten
  sonra değerlendirilir.

## 5.3 — Operasyon geliştirmeleri

- Google veya Outlook ile iki yönlü takvim senkronizasyonu.
- Portal üzerinden güvenli evrak yükleme, süreç/eksik evrak görünürlüğü.
- Danışman kapasite ve iş yükü planlama ile tahsilat/geciken ödeme takibi.
