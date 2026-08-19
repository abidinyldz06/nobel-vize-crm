# Faz 5 — Veri Kalitesi, Gerçek İletişim ve Operasyon Geliştirmeleri

Son güncelleme: 19 Ağustos 2026

Durum: Faz 5.0–5.6 uygulama, GitHub CI ve production kabulünden geçti. Resend
üzerinden gerçek e-posta teslimi ve Google Takvim gidiş-dönüş eşitlemesi canlıda
doğrulandı. Google ile giriş, yönetici MFA politikasıyla production'da aktiftir.
Daha geniş Google kullanıcı yayılımı öncesinde public gizlilik/şartlar sayfaları
ve hassas kapsam doğrulama başvurusu tamamlanmalıdır; WhatsApp Business ayrı
ürün ve maliyet kararı olarak kapsam dışındadır.

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

### 5.1.3 — Şirket iletişim bilgisi doğrulama (tamamlandı ve production'da)

- Şirket adı, e-posta ve telefon yalnızca yönetici doğrulama akışından
  güncellenir; doğrudan istemci yazımı kapalıdır.
- Her doğrulamada resmî kaynak bağlantısı, zaman damgası ve doğrulayan
  personel tek şirket kaydında saklanır; sistem loguna denetim olayı eklenir.
- Arayüzde doğrulama tarihi ve kaynak bağlantısı görünür. Bu doğrulama akışı
  tek başına e-posta/WhatsApp gönderimini etkinleştirmez.
- 19 Ağustos 2026'da `bilgi@nobelvize.com` ve `+90 533 499 57 50`, Nobel
  Vize'nin resmî iletişim sayfası kaynak gösterilerek production'da kaydedildi.

## 5.4 — Kaynak izlenebilir ülke/vize evrak kataloğu (production'da)

- Kural başına resmî ve ikincil kaynaklar, kontrol zamanı ve yeniden kontrol
  tarihi saklanır; kaynak durumu arayüzde rozetle gösterilir.
- Doğrudan tarayıcı yazımı kapalıdır. Yönetici kayıt/doğrulama/silme işlemleri
  kontrollü RPC ve audit log üzerinden çalışır.
- İlk doğrulanmış paket Almanya iş seyahatidir. Fransa turistik ve öğrenci
  kayıtları France-Visas'ın profile göre ürettiği kesin listeyle
  karşılaştırılana kadar kontrol bekliyor olarak tutulur.
- 3GEN Vize ülke ve profil kapsamı için ikincil referanstır; resmî kaynakla
  çelişkide resmî kaynak esas alınır.
- Ayrıntılı kapsam ve kabul kapıları:
  `docs/PHASE_5_4_COUNTRY_RULE_CATALOG.md`.

## 5.2 — Gerçek iletişim sistemi (production'da ve canlı)

- Resend uyumlu gerçek e-posta adaptörü, idempotent outbox teslimatı ve
  imzalı teslim/bounce webhook'u uygulandı.
- İzin/ret denetimi, kuyruk retry davranışı ve varsayılan kapalı sağlayıcı
  durumu korunur. Doğrulanmış sender domain ve Vercel secret'ları girilmeden
  e-posta dışarı gönderilmez.
- Resend production sağlayıcısı etkinleştirildi. 19 Ağustos 2026 tarihli canlı
  kabul iletisi sağlayıcı tarafından kabul edildi ve delivery webhook'u
  outbox kaydını `delivered` durumuna getirdi; son hata kodu yoktur.
- WhatsApp Business ayrı ürün/maliyet kararı gerektirdiği için kapsam dışıdır.

## 5.3 — Operasyon geliştirmeleri (production'da ve canlı)

- Google Calendar ile bağlı CRM randevuları için iki yönlü senkronizasyon;
  şifreli token saklama, imzalı OAuth state ve günlük cron eklendi. Outlook
  kapsam dışıdır.
- Portal üzerinden private Storage'a imzalı, tür/boyut doğrulamalı evrak
  yükleme ve danışman bildirimi eklendi.
- Danışman kapasite/iş yükü limitleri ile son ödeme tarihli tahsilat ve
  geciken ödeme görevi eklendi.
- PR #55 ana dala alınmış, GitHub Quality Gates yeşil, production migration
  zinciri eşleşmiş ve canlı health kontrolü HTTP 200 olarak doğrulanmıştır.
- Google ile giriş ve Takvim activation paketi PR #65 ile ana dala alındı.
  Production yöneticisi Google hesabıyla giriş yaptı, MFA sonrasında Dashboard'a
  ulaştı ve kendi birincil takvimini bağladı.
- Canlı gidiş-dönüş kabulünde yakalanan eşitleme sırası kusuru PR #66 ile
  düzeltildi. CRM randevusu Google'a yazıldı; Google'da 15:15'e alınan randevu
  yeni konumuyla CRM'e `rescheduled` olarak döndü ve Google tarafında korunarak
  yeniden eşitlendi.

## 5.6 — Canlı sağlayıcı kabulü ve dürüst kapanış

- Resmî şirket iletişim alanları production'da kaynakla doğrulandı.
- Resend gerçek delivery webhook'u ve Google Takvim iki yönlü kabulü geçti.
- Kabul sırasında oluşturulan sentetik müşteri arşivlendi, test randevusu iptal
  edildi ve bağlı Google etkinliği kaldırıldı; production'da aktif test müşteri
  bırakılmadı.
- Ayrıntılı kanıt ve kalan dış yönetişim işi:
  `docs/PHASE_5_6_LIVE_ACCEPTANCE.md`.

Faz 5.2–5.3'ün ayrıntılı teknik ve aktivasyon kaydı:
`docs/PHASE_5_2_5_3_IMPLEMENTATION_REPORT.md`.
