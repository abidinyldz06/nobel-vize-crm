# Sürüm Notları (Changelog)

Bu dosyada Nobel Vize CRM projesine eklenen tüm yeni özellikler, düzeltmeler ve değişiklikler yer almaktadır.

## [Unreleased] — Faz 4.6–4.9 KVKK, Lead, Takvim ve Bakım

### KVKK ve lead operasyonları

- Veri değiştirmeyen dry-run aday listesi, saklama kilidi, yönetici onay
  kuyruğu, kalıcı silmede iki ayrı onay ve son onaydan sonra doğrulanmış yedek
  kapısı eklendi.
- Storage temizliği tamamlanmadan sonuçlandırmayı engelleyen kontrollü
  anonimleştirme/silme yürütücüsü ve değiştirilemez privacy audit izi eklendi.
- Kaynak, kampanya, yönlendirme, SLA ve sorumlu takibi bulunan lead yaşam
  döngüsü; normalize mükerrer tespiti ve kontrollü müşteriye dönüşüm eklendi.
- Geciken lead takipleri mevcut zamanlanmış görev altyapısına idempotent
  biçimde bağlandı.

### Takvim ve gerçek raporlar

- Randevu çakışma kontrolü, iptal/gelmedi/tamamlandı durumları, değiştirilemez
  randevu geçmişi ve Europe/Istanbul saat dilimli ICS çıktısı eklendi.
- Ülke/vize sonucu, bekleyen tahsilat yaşlandırma, lead SLA ve danışman iş
  yükü raporları eklendi.
- Ekranla aynı yetki ve dönem filtresini kullanan CSV ve PDF çıktıları eklendi.

### Bakım ve kalite

- Next.js, React, Supabase, Playwright ve diğer uyumlu patch/minor
  bağımlılıklar güncellendi; `pdf-lib` ile sunucu tarafı PDF üretimi eklendi.
- Haftalık Dependabot patch/minor grubu ve zamanlanmış production dependency
  audit workflow'u eklendi; ana sürüm yükseltmeleri otomatik kapsam dışında
  bırakıldı.
- Toplu doğrulama 65 Node testi, 324 pgTAP, restore drill, 26 Playwright testi,
  temiz şema lint'i, production audit ve Next.js build ile geçti.

## [Unreleased] — Faz 4.2–4.5 Otomasyon ve Güvenlik

### Operasyon ve iş sürekliliği

- Secret korumalı Vercel Cron ile pasaport, randevu, evrak, ödeme ve
  hareketsiz başvuru görevleri sayfa ziyaretinden bağımsız hale getirildi.
- Zamanlanmış işlere advisory lock, saat/gün penceresi idempotency'si, çalışma
  geçmişi ve operasyon hata kaydı eklendi.
- Veritabanı ile private Storage binary'lerini aynı recovery point'e alan,
  AES-256-GCM şifreli ve SHA-256 doğrulamalı zamanlanmış yedek eklendi.
- Günlük 14, haftalık 8 ve aylık 12 kopyalık retention ile Faz 4.2–4.5
  tablolarının backup/restore uyumluluğu eklendi.

### Hesap ve iletişim güvenliği

- Admin için zorunlu, danışman için politika tabanlı TOTP/MFA; giriş kilidi,
  güvenlik audit izi ve aktif oturum yönetimi eklendi.
- Kanal/amaç bazlı iletişim izni, pazarlama rızası kontrolü, idempotent outbox,
  retry ve imzalı webhook/replay koruması eklendi.
- Sağlayıcı kabulü ile gerçek teslimat ayrıldı. Gerçek sağlayıcı seçilene
  kadar worker kapalı ve manuel `mailto:`/`wa.me` fallback'i korunuyor.

### Kalite ve işletim

- Birim, güvenlik, pgTAP ve Playwright regresyonları ile production runbook'u
  eklendi.
- Cron, yedek ve mesaj secret'ları `.env.example` içinde yalnız sunucu
  değişkenleri olarak belgelendi.
- Faz 4.2 operasyon cron'u production'da yetki ve idempotency kontrolleriyle
  doğrulandı.
- Faz 4.3 ilk zamanlanmış production yedeği 269 veritabanı satırı ve 1 private
  Storage nesnesiyle oluşturulup `verified` olarak doğrulandı.
- Service-role yedek doğrulamasının sistem olayını personel kimliği olmadan
  kapatabilmesi ve başarısız günlük pencerenin kontrollü yeniden denenmesi
  production hotfix migration'ıyla düzeltildi.

## [Unreleased] — Faz 4.1.1 Stabilizasyon ve Veri Bütünlüğü

### Düzeltildi

- Boş başvuru profil alanlarının evrak kuralını yanlışlıkla elemesi kaldırıldı;
  arayüz ve veritabanı aynı kararlı fallback sıralamasına geçirildi.
- Varsayılan tema açık moda çevrildi.
- Etiket filtresi ana etiket kataloğundan beslenerek hazır etiketlerin boş
  listede de görünmesi sağlandı.
- Görev ekranına sunucu ilk verisi, görünür yenileme hatası ve tekrar deneme
  davranışı eklendi.
- Yeni ve düzenlenen başvurularda profil alanları zorunlu hale getirildi;
  eksik geçmiş kayıtlar için müşteri filtresi eklendi.
- Boş şirket iletişim bilgilerinin örnek placeholder ile karıştırılmasını
  engelleyen ayar uyarısı eklendi.

### Veri bütünlüğü

- Normalize telefon, e-posta ve pasaport üzerinden transaction seviyesinde
  mükerrer müşteri koruması ile açık kullanıcı istisnası eklendi.
- Başvuru profil değerleri müşteri/başvuru oluşturma transaction'ına alındı.
- Doğrulanmış ALPER ORS mükerrer kaydı hard delete uygulanmadan, ilişkileri
  korunarak kanonik müşteriye birleştirilecek migration eklendi.
- Birim, pgTAP, Playwright ve release-gate regresyon kapsamı genişletildi.

## [Unreleased] — Faz 4.1 Müşteri Puanlamasının Kaldırılması

### Değiştirildi

- Sabit kurallı `profile_score` hesabı müşteri oluşturma, düzenleme, import,
  Google Form webhook ve evrak onay akışlarından kaldırıldı.
- Müşteri liste, kart, detay ve CSV çıktılarındaki puan göstergeleri ile
  "AI Profil Analizi" arayüzleri kaldırıldı.
- Gerçek veriye dayanmayan `%98`, `%76` ve `%34` profil raporu yerine seçili
  dönemin gerçek evrak tamamlanma metrikleri gösterilmeye başlandı.
- Teknik evrak kuralı eşleştirmesi müşteri değerlendirmesi üretmediğini açıkça
  gösterecek biçimde yeniden adlandırıldı.

### Veritabanı ve kalite

- `customers.profile_score` kolonu ile doğrulama constraint'i yeni migration
  üzerinden kaldırıldı; müşteri oluşturma, güncelleme ve anonimleştirme
  RPC'leri yeni şemaya uyarlandı.
- Üretilen TypeScript tipleri ve şema anlık görüntüleri yenilendi.
- Eski v2 yedeklerdeki fazladan `profile_score` alanının güvenle yok sayıldığı
  pgTAP ve restore tatbikatıyla doğrulandı.
- Kaynak kodda skor davranışının yeniden eklenmesini engelleyen release gate
  regresyonu eklendi.
- GitHub application, database, browser ve Vercel kapıları başarılı oldu;
  şifreli production continuity yedeği doğrulandı, migration production'a
  uygulandı ve canlı health kontrolleri tamamlandı.

## [Unreleased] — Faz 4.0 Plan ve İş Listesi

### Planlandı

- Faz 4 alt aşamaları, bağımlılıkları, kapsam dışı maddeleri ve ölçülebilir
  kabul kriterleri ayrı plan belgesinde tanımlandı.
- Yanıltıcı sabit müşteri profil puanlamasının arayüz, uygulama mantığı,
  veritabanı ve raporlardan kaldırılması ilk uygulama paketi olarak belirlendi.
- Zamanlanmış operasyon, otomatik şifreli DB/Storage yedeği, MFA ve giriş
  güvenliği, sağlayıcı destekli iletişim, kontrollü KVKK otomasyonu, lead
  yönetimi, takvim ve gerçek raporlar sıralı yol haritasına alındı.
- Faz 4 milestone'u ve 4.1–4.9 için sıralı GitHub issue kayıtları oluşturuldu.
- SaaS/tenant, abonelik, paket, kota, white-label ve subdomain geliştirmelerinin
  Faz 4 kapsamı dışında kalacağı yeniden doğrulandı.

## [Unreleased] — Faz 3.8 Son Kalite ve Kullanıcı Kabulü

### Eklendi

- Admin, danışman, pasif personel, staff bağlantısız Auth hesabı ve anonim
  kullanıcı için sayfa/API/RLS kabul matrisi.
- Tekrarlanabilir Auth/personel fixture üretimi, hataları doğrulanan cleanup ve
  sıfır artık kayıt kontrolü sağlayan ortak Playwright test desteği.
- İki danışmanın müşteri, başvuru, evrak, not, ödeme, görev ve bildirim
  izolasyonunu doğrulayan Faz 3.8 rol E2E paketi.
- Müşteri oluşturma, otomatik başvuru/evrak/not üretimi, randevu, evrak onayı
  ve ödeme kaydını tek kabul zincirinde doğrulayan kritik akış paketi.
- Boş danışman ekranları, bozuk ve eksik API istekleri, eşzamanlı durum
  değişimi, tekrar deneme idempotency'si ve iki kez cleanup kontrolleri.
- 390px mobil ve 1440px masaüstü taşma kabulü, WCAG 2 A/AA axe taraması,
  klavye/landmark senaryoları ve dashboard performans bütçeleri.
- Tek komutta uygulama, temiz migration, DB tipi, pgTAP, restore ve tam
  Playwright doğrulaması yapan release adayı kapısı.
- Liveness, readiness ve login rotalarını veri değiştirmeden doğrulayan
  production kapanış komutu.
- Production doğrulamasındaki giriş kontrolü, uygulamanın gerçek giriş rotası
  olan `/` adresine bağlandı.

### Düzeltildi

- Yeni müşteri formundaki danışman notunun RPC tarafından beklenen
  `consultant_note` alanına da aktarılması sağlandı; notun başvuru timeline'ına
  sessizce yazılmaması sorunu kapatıldı.
- Evrak ve ödeme panellerine kararlı E2E seçicileri ile ödeme alanlarına
  erişilebilir adlar eklendi.
- Ana içeriğe geç bağlantısı, etiketli landmark/navigation, mobil menü
  açma-kapatma adları, Escape/focus dönüşü ve görünür odak stilleri eklendi.
- Koyu temadaki ikincil metin kontrastı WCAG AA seviyesine çıkarıldı; hareket
  azaltma tercihi ve dar ekran müşteri filtre yerleşimi iyileştirildi.
- Tema ve mobil menü kontrolleri hydration tamamlanana kadar kararlı erişilebilir
  ad ve etkileşim durumu kullanacak şekilde düzenlendi.
- ESLint/Next lint zincirinde doğrudan düzeltilebilen `js-yaml` ve
  `brace-expansion` sürümleri güncellendi.

### Güvenlik

- Personel yeni, düzenleme ve performans alt sayfalarına doğrudan URL ile
  danışman erişimi kapatıldı.
- Danışman menüsünden admin-only Ülke & Evraklar, Personel ve Ayarlar
  bağlantıları kaldırıldı.
- Çapraz müşteri güncelleme, evrak indirme, yedek, toplu arşiv ve toplu
  danışman atama yetkileri regresyon kapsamına alındı.
- Eşzamanlı aynı başvuru durum geçişinin yalnız bir kez uygulanıp tek audit
  üretmesi regresyon kapsamına alındı.
- Anonim/PUBLIC rollerinin tüm `public` tablo ve fonksiyon yetkileri kaldırıldı;
  gelecekteki nesneler için güvenli default privilege tanımlandı.
- Aktif personelin `staff.user_id` Auth bağlantısını kaybetmesi doğrulanmış
  constraint ile engellendi.
- Tüm public tabloların RLS, SECURITY DEFINER search path, audit actor ve
  anonim yetki envanteri pgTAP kapanış testine bağlandı.
- Production doğrulamasında bulunan, migration zinciri dışındaki eski
  `appointments` tablosunun RLS'i veri silmeden etkinleştirildi ve anonim
  yetkileri kapatıldı.

### CI

- Ağ erişimi olmayan GitHub runner kapanışında PostHog timeout'u ile başarılı
  DB lint sonucunu kırmaması için Supabase CLI telemetrisi kalite işlerinde
  açıkça kapatıldı.
- Production dependency audit isimlendirilmiş ve bloklayıcı
  `audit:production` kapısında ortaklaştırıldı.
- Faz 3.8 release/rollback/production doğrulama rehberi ve bilinen sınırlamalar
  yayımlandı; Faz 3.1–3.8 kapanışı tamamlandı.

## [Unreleased] — Faz 3.7 İzleme ve İş Sürekliliği

### İzleme ve olay yönetimi

- Uygulama ve API isteklerine uçtan uca UUID request ID eklendi.
- Kişisel veri, secret ve ham hata mesajı taşımayan allowlist tabanlı
  yapılandırılmış JSON logları eklendi.
- Minimal liveness ile ortam, veritabanı ve private Storage erişimini sınayan
  aggregate readiness endpoint'leri eklendi.
- Tekrarlanan operasyonel hataları birleştiren, yalnız admin tarafından
  görüntülenip kapatılabilen olay ve bildirim akışı eklendi.

### Yedekleme ve kurtarma

- Yedek başlangıç, tamamlanma, hata ve doğrulama geçmişi admin kontrollü
  RPC'lere taşındı.
- JSON yedeğine SHA-256, tablo/satır sayısı ve recursive private Storage
  envanteri eklendi; Storage binary'lerinin pakette olmadığı açıkça işaretlendi.
- 36 saati geçen doğrulanmış yedek için `backup.stale` uyarısı ve başarılı
  doğrulamada otomatik kapanma eklendi.
- Yalnız yerel Supabase'e bağlanan, transaction sonunda rollback yapan ve
  tablo/Storage bütünlüğünü karşılaştıran geri yükleme tatbikatı eklendi.
- RPO/RTO hedefleri, SEV seviyeleri, yedekleme, restore kapıları ve olay kapatma
  adımlarını içeren müdahale rehberi eklendi.

### Kalite

- Gözlemlenebilirlik, olay, yedek ve restore akışları pgTAP, birim, güvenlik ve
  oturumlu Playwright testleriyle kapsam altına alındı.
- Paylaşılan yerel Supabase fixture'larında çapraz test çakışmasını önlemek için
  Playwright paketi tek worker'a sabitlendi.
- İletişim popup testi, veritabanı kaydı tamamlanmasını bekleyerek geçici boş
  sorgu sonucunu güvenli biçimde yeniden deneyecek şekilde sağlamlaştırıldı.
- GitHub Actions Node 24 uyumlu action sürümlerine taşındı ve database kalite
  kapısına izole restore tatbikatı eklendi.
- GitHub application, database, browser ve Vercel kapıları başarıyla tamamlandı.
- Production öncesi auth/public/storage şema, veri, roller ve private Storage
  nesnesi repo dışında AES-256 ile şifrelenip bağımsız açma kontrolünden geçirildi.
- İki Faz 3.7 migration'ı production'a uygulandı; ana veri ve Storage sayıları
  korunarak uzak migration zinciri ile şema lint kontrolü doğrulandı.
- Production liveness/readiness, admin girişi, 9 müşterinin görünürlüğü,
  operasyon ekranı ve 24 tablolu/1 Storage nesneli SHA-256 yedek akışı canlıda
  doğrulandı; geçici test kimlikleri tamamen temizlendi.

## [Unreleased] — Faz 3.6 KVKK ve Veri Yaşam Döngüsü

### KVKK kayıtları

- Admin tarafından sürümlenen aydınlatma metinleri ile müşteriye teslim ve teyit kanıtı eklendi.
- Aydınlatma kaydından ayrı tutulan açık rıza verme, reddetme ve geri çekme geçmişi eklendi.
- Erişim, dışa aktarma, düzeltme, kısıtlama, silme ve anonimleştirme talepleri için takip akışı eklendi.
- Admin kontrollü müşteri veri paketi ve privacy audit kaydı eklendi.

### Veri yaşam döngüsü

- Saklama süreleri, arşiv bekleme süresi ve müşteri bazlı saklama kilidi eklendi.
- Storage dosyaları temizlenmeden anonimleştirmeyi engelleyen kontrollü işlem zinciri eklendi.
- Kalıcı silme; onaylı talep, bekleme süresi ve anonimleştirme koşullarına bağlandı.
- KVKK tabloları sürümlü JSON yedek ve atomik geri yükleme kapsamına alındı.
- Telefon, e-posta ve pasaport bilgileri liste, arama ve özet ekranlarında maskelendi.

### Kalite

- KVKK yaşam döngüsü için pgTAP, birim, güvenlik regresyonu ve oturumlu Playwright senaryoları eklendi.
- Otomatik silme varsayılan olarak kapalı tutuldu; bu sürümde arka plan silme görevi etkinleştirilmedi.
- GitHub application, database, browser ve Vercel kalite kapıları başarıyla tamamlandı.
- Production öncesi veritabanı ve Storage birlikte şifreli yedeklendi; geri açma doğrulaması yapıldı.
- Faz 3.6 migration'ları production'a uygulandı; ana veri sayıları korunarak canlı KVKK yaşam döngüsü doğrulandı.
- Eksik production Google Form webhook secret'ı yenilenip Sensitive Environment olarak tanımlandı; imzasız isteklerin 401 ile reddi doğrulandı.

## [Unreleased] — Faz 3.5 Müşteri İletişimi ve Portal

### İletişim

- Admin tarafından yönetilen WhatsApp ve e-posta şablonları eklendi.
- Kontrollü değişkenlerle çalışan ortak mesaj hazırlayıcı eklendi.
- İletişim kayıtlarına hazırlanmış, gönderilmiş ve başarısız durumları ile hata nedeni eklendi.
- İletişim yazmaları atomik, yetki kontrollü ve audit kayıtlı RPC akışlarına taşındı.
- Harici sağlayıcı bulunmadığında teslimat iddiasında bulunmayan manuel doğrulama akışı eklendi.

### Müşteri portalı

- Portal bağlantılarına son kullanma, etkinlik ve son erişim takibi eklendi.
- Portal token yenileme, erişimi kapatma ve yeniden açma kontrolleri eklendi.
- Portal başvuru geçmişi ve şirket ayarlarından gelen iletişim bilgileriyle genişletildi.

### Kalite

- Mesaj değişkenleri için birim testleri ve iletişim/portal güvenlik regresyonları eklendi.
- Şablon, iletişim ve portal yaşam döngüsü pgTAP kapsamına alındı.
- Şablon yönetiminden portal iptaline uzanan oturumlu Playwright senaryosu eklendi.
- Faz 3.5 migration'ları, Vercel production yayını ve canlı kullanıcı akışı doğrulandı.

## [Unreleased] — Faz 3.4 Başvuru ve Müşteri Operasyonu

### Başvuru yönetimi

- Personel, ülke, tarih ve gecikme filtreli yatay süreç panosu eklendi.
- Geçersiz aşama atlamaları veritabanında engellendi; durum, toplu durum ve randevu işlemleri atomik audit akışlarına taşındı.
- Müşteri düzenleme ve detay ekranlarına ülke, vize türü, seyahat aracı, konaklama, meslek, çocuk ve uyruk alanları eklendi.

### Müşteri deneyimi ve dashboard

- VIP, Acil, Reddi Var ve Premium hazır etiketleri; renkli rozet ve etiket filtresi eklendi.
- Telefon, WhatsApp, e-posta ve audit'li hızlı not eylemleri eklendi.
- Başvuru, evrak, ödeme, randevu, iletişim ve notları birleştiren dikey timeline eklendi.
- Altı aylık pasaport uyarıları ve aylık başvuru/onay/red/bekleyen/gerçekleşen gelir kartları eklendi.

### Kalite

- pgTAP, güvenlik, dashboard birim testleri ve birleşik Playwright kullanıcı akışı genişletildi.
- Production oturum yönlendirmesi yeni auth çerezini ayrı dashboard isteğinde okuyacak biçimde sağlamlaştırıldı.
- Eski production şemasındaki yinelenen başvuru-müşteri foreign key kaldırılarak PostgREST ilişki belirsizliği giderildi.
- Production-smoke modu, canlı ortam taban URL'si ve uzak sorgulara uygun bekleme süreleriyle eklendi.
- Faz 3.4 migration'ları, Vercel yayını ve oturumlu canlı E2E akışı doğrulandı.

## [Unreleased] — Acil Paket H2 Müşteri Arşivi

### Veri güvenliği

- Müşteri hard delete işlemi admin kontrollü soft delete akışına çevrildi.
- Arşivleme ve geri yükleme işlemlerine atomik audit kaydı eklendi.
- Aktif müşteri sorguları arşiv kayıtlarını dışarıda bırakacak biçimde güncellendi.
- Admin Arşiv ekranı, geri yükleme ve 30 gün sonrası kontrollü kalıcı silme eklendi.

### Kalite ve bağımlılıklar

- Arşivleme yaşam döngüsü için pgTAP, güvenlik regresyonu ve oturumlu Playwright testi eklendi.
- Next.js `16.2.11` sürümüne güncellendi; production bağımlılık audit bulguları giderildi.

## [Unreleased] — Faz 1 Veritabanı Standardizasyonu

### Veri bütünlüğü

- Boş veritabanından tekrar üretilebilen Supabase CLI migration zinciri eklendi.
- Ülke/vize kuralları `country_visa_rules` modelinde birleştirildi.
- Kritik foreign key, check constraint ve indeksler standardize edildi.
- Müşteri/başvuru oluşturma ile durum güncelleme işlemleri atomik RPC'lere
  taşındı.

### Yedekleme ve operasyon

- Sayfalı ve sürümlü v2 JSON yedeği ile transaction tabanlı atomik geri yükleme
  eklendi.
- Salt-okunur şema envanteri ve veri kalite ön kontrol betikleri eklendi.
- Yerel pgTAP testleri, Faz 1 yayın rehberi ve tek kiracılı mimari karar kaydı
  eklendi.

## Faz 0 Güvenlik Temeli

### Güvenlik

- Merkezi, kapalı-varsayımlı personel ve admin yetkilendirmesi eklendi.
- API route'ları aktif personel/admin kontrolüyle korundu.
- Google Form webhook'una HMAC-SHA256 imzası, zaman damgası ve tekrar olay engeli eklendi.
- Ortak personel şifresi kaldırıldı; Supabase güvenli davet akışına geçildi.
- İlk Auth kullanıcısını otomatik admin yapan davranış kaldırıldı.
- Müşteri portalı anonim tablo politikaları yerine sınırlı sunucu sorgularına taşındı.
- Evrak bucket'ı private erişime ve kısa süreli signed URL indirmeye taşındı.
- Admin/danışman ayrımını koruyan recursion-safe RLS migration'ı hazırlandı.
- Atomik olmayan restore işlemi varsayılan olarak devre dışı bırakıldı.

### Kalite ve dokümantasyon

- Teknik inceleme, faz yol haritası ve staging/canlı yayın rehberi eklendi.
- Webhook imzası ve kritik güvenlik regresyonları için otomatik testler eklendi.
- Harici Google Fonts derleme bağımlılığı kaldırıldı.
- Next.js 16 lint komutu düzeltildi ve temel HTTP güvenlik başlıkları eklendi.

## [v1.2.0] - Temmuz 2026

### ✨ Yeni Özellikler (Kosmosvize Modeli)
- **Akıllı Evrak Seçim Sistemi**: Ülke ve vize kategorisine ek olarak; seyahat aracı (uçak, tur vb.), konaklama (otel vb.), meslek, çocuk durumu ve uyruğa göre dinamik evrak listesi oluşturabilme özelliği eklendi.
- **Dinamik Kural Düzenleyici**: Yönetici panelindeki "Ülkeler" sayfasında, her bir ülke için sınırsız evrak kuralı tanımlayabilmenizi sağlayan yeni form modülü yazıldı.
- **Gelişmiş Form Eşleştirme**: Müşteri eklerken seçilen kriterleri hesaplayarak arka plandaki en uygun (spesifik) evrak kuralını tespit edip dosya içerisine atan "SmartDocumentSelector" geliştirildi.

### 🛠️ Değişiklikler ve İyileştirmeler (Veritabanı)
- `country_visa_requirements` tablosu devreden çıkartılarak daha kapsamlı alanlara sahip `country_visa_rules` tablosu oluşturuldu. Eski evrak kuralları (veri kaybı olmadan) yeni sisteme entegre edildi.

---

## [v1.1.0] - Temmuz 2026

### ✨ Yeni Özellikler (Log ve Yedekleme)
- **Sistem Logu (Audit Log)**: Tüm müşteri kayıt, güncelleme, belge ekleme, ödeme ve randevu gibi önemli aksiyonların kim tarafından (Danışman veya Admin) ne zaman yapıldığının takip edilebildiği "Sistem Logu" modülü eklendi.
- **Tam Veri Yedekleme**: Ayarlar sekmesine tüm Supabase tablolarını anlık olarak JSON dosyasında bilgisayara indirebilen güvenli yedekleme aracı (API Route tabanlı) dahil edildi.
- **CSV Dışa Aktarma**: Sistem kayıtlarının analiz amaçlı tablo (Excel vb.) programlarında açılabilmesi için tüm müşterilerin listesini CSV formatında indirebilme imkânı getirildi.

### 🐛 Hata Düzeltmeleri (Bug Fixes)
- **GoTrueClient Uyarısı**: Konsolda beliren "Multiple GoTrueClient instances detected in the same browser context" uyarıları giderildi. `@supabase/ssr` paketi optimize edilerek `supabase-browser.ts` içerisindeki client, Singleton tasarım desenine göre tekilleştirildi. Bileşenlerin her birinde yaşanan performans sorunlarının önüne geçildi.

---

## [v1.0.0] - Haziran 2026
- Projenin ilk stabil versiyonu canlıya alındı. Müşteri ekleme, evrak yükleme, ödeme takibi, müşteri portalı (extranet) ve yönetici/danışman dashboard grafikleri tamamlandı.
