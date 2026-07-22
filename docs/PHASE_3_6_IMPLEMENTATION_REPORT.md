# Faz 3.6 — KVKK ve Veri Yaşam Döngüsü Uygulama Raporu

Tarih: 22 Temmuz 2026
Durum: Tamamlandı; GitHub, production migration ve canlı doğrulama dahil

## Amaç ve sınırlar

Bu aşama, Nobel Vize iç CRM'indeki kişisel verilerin hangi metin ve karara
dayanarak işlendiğinin kanıtlanmasını; ilgili kişi taleplerinin izlenmesini ve
verinin kontrollü biçimde dışa aktarılması, arşivlenmesi, anonimleştirilmesi ve
son aşamada silinmesini sağlar.

Uygulamadaki metinler ve varsayılan süreler hukuki görüş yerine geçmez.
Aydınlatma içeriği, rıza gerektiren amaçlar ve saklama süreleri şirketin hukuk
danışmanı tarafından onaylanmalıdır. Sistem bu nedenle otomatik silmeyi
varsayılan olarak kapalı tutar ve bu sürümde arka plan silme görevi çalıştırmaz.

## 3.6.1 — Sürümlü aydınlatma kaydı — Bitti

- Aydınlatma metinleri sürüm, başlık, içerik, yürürlük zamanı ve aktiflik
  bilgisiyle saklanır.
- Yalnız admin yeni sürüm oluşturabilir veya mevcut sürümü yönetebilir.
- Müşteriye teslim kanalı, teslim zamanı, teyit zamanı ve kanıt notu değişmez
  geçmiş kaydı olarak tutulur.
- Personel yalnız kendisine atanmış müşteriler için kayıt oluşturabilir.

## 3.6.2 — Ayrı açık rıza geçmişi — Bitti

- Aydınlatma teslimi açık rıza kabulü sayılmaz.
- Amaç bazlı `granted`, `refused` ve `withdrawn` kararları ayrı kayıtlardır.
- Önceki kararlar güncellenmez veya silinmez; güncel durum en son karardan
  hesaplanır.
- Rıza kanıtı privacy audit kaydına bağlanır.

## 3.6.3 — İlgili kişi talepleri ve veri paketi — Bitti

- Erişim, dışa aktarma, düzeltme, kısıtlama, silme ve anonimleştirme talep
  türleri desteklenir.
- Talep alınma, inceleme, onay, tamamlanma, ret ve iptal durumları izlenir.
- Admin, müşterinin ilişkili CRM kayıtlarını JSON veri paketi olarak indirebilir.
- Paket ikili Storage dosyalarını içermez; dosya meta verisini içerir ve dışa
  aktarma işlemi audit log'a yazılır.

## 3.6.4 — Saklama ve kontrollü anonimleştirme — Bitti

- Müşteri, evrak ve arşiv bekleme süreleri ayarlardan yönetilir.
- Hukuki/operasyonel zorunluluk için müşteri bazlı saklama kilidi desteklenir.
- Anonimleştirme yalnız admin, onaylı silme/anonimleştirme talebi, dolmuş arşiv
  süresi ve pasif saklama kilidi koşullarıyla çalışır.
- Müşteri PII alanları ile ilişkili not, iletişim, başvuru profil alanı, ödeme
  açıklaması, görev/bildirim metni ve rıza kanıtı temizlenir veya anonimleştirilir.
- Operasyonel ve toplu raporlama için gerekli kimliksiz iskelet korunur.

## 3.6.5 — Storage, maskeleme ve yedekleme — Bitti

- Storage dosyaları fiziksel olarak silinmeden veritabanındaki dosya bağlantısı
  temizlenmez ve müşteri anonimleştirilemez.
- Storage temizliği öncesinde onaylı talep, arşiv süresi ve saklama kilidi sunucu
  tarafında yeniden doğrulanır.
- Telefon, e-posta ve pasaport bilgileri liste, global arama, dashboard, arşiv,
  aile üyesi ve WhatsApp hatırlatma ekranlarında maskelenir; yetkili eylemler ham
  değeri kullanmaya devam eder.
- KVKK tabloları v2 yedek ve atomik geri yükleme sırasına dahil edilmiştir; eski
  v2 yedekler isteğe bağlı KVKK tabloları olmadan da geri yüklenebilir.

## 3.6.6 — Kalite ve yayın — Bitti

Tamamlanan yerel kanıtlar:

- migration zinciri sıfır veritabanından başarıyla kuruldu
- database lint: 0 şema hatası
- pgTAP: 196/196 başarılı
- uygulama ve güvenlik testleri: 31/31 başarılı
- Playwright: 10/10 başarılı
- dependency audit: 0 yüksek seviye açık
- Next.js production build: başarılı

Production ve GitHub kanıtları:

- [PR #21](https://github.com/abidinyldz06/nobel-vize-crm/pull/21) application,
  database, browser ve Vercel kontrolleri geçtikten sonra squash merge edildi
- birleşen `fc8e448` commit'i için `main` kalite akışı başarılı oldu
- public/auth/storage şema ve verisi, roller ve gerçek Storage nesneleri repo
  dışında AES-256 ile şifreli yedeklendi
- şifreli yedek ayrı Keychain anahtarıyla açıldı; arşiv hash'i ve tar
  bütünlüğü doğrulandı, düz metin geçici dosya bırakılmadı
- production migration geçmişinde yalnız 010–012 beklediği dry-run ile
  doğrulandı ve üç migration başarıyla uygulandı
- uzak şema lint sonucu 0 hata verdi
- migration öncesi/sonrası ana veri sayıları 9 müşteri, 3 personel ve 7
  başvuru olarak korundu
- KVKK ayar kaydı 30 günlük arşiv süresi ve kapalı otomatik işlem varsayılanıyla
  oluşturuldu
- Vercel production deployment `Ready` durumuna geldi ve
  `abidinyildiz.com` alan adına bağlandı
- canlı Faz 3.6 ve smoke paketi 5/5 geçti; geçici Auth, personel, müşteri ve
  KVKK test kayıtlarının tamamı temizlendi

Production kontrolünde Supabase CLI dry-run çıktısının veritabanı parolasını
gösterebildiği fark edildi. Parola Supabase Management API üzerinden döndürüldü,
yeni değer yalnız macOS Keychain'de saklandı ve yeni şema dump bağlantısıyla
doğrulandı. Ayrıca eksik `GOOGLE_FORM_WEBHOOK_SECRET` 64 karakterlik yeni bir
değerle Vercel Production Sensitive Environment'a eklendi; imzasız webhook
isteğinin yeniden 401 dönmesi doğrulandı.

## Migration envanteri

- `202607220010_phase36_privacy_foundation.sql`
- `202607220011_phase36_data_lifecycle.sql`
- `202607220012_phase36_privacy_backup.sql`

## Güvenlik kararları

- KVKK tablolarında doğrudan authenticated yazma yetkileri kapalıdır; yazmalar
  yetki ve audit kontrolü yapan RPC'lerden geçer.
- Veri paketi, Storage temizliği ve anonimleştirme API'leri aktif admin gerektirir.
- Kalıcı silme yalnız anonimleştirilmiş ve yapılandırılmış bekleme süresini
  doldurmuş arşiv kayıtlarında çalışır.
- Secret değerleri istemciye veya yedek paketine eklenmez.
