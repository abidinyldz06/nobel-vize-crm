# Nobel Vize CRM — Başlangıçtan Bugüne Proje Geçmişi ve Güncel Durum

- Denetim tarihi: 20 Ağustos 2026
- Repository: `https://github.com/abidinyldz06/nobel-vize-crm`
- Production: `https://abidinyildiz.com`
- İncelenen ana dal başlangıcı: `6839d101363bdb28d3950e65cdedc59890f0a544`
  (`docs: record phase 5.6 live acceptance (#67)`)

## 1. Yönetici özeti

Nobel Vize CRM, Haziran 2026'daki ilk ürün sürümünden sonra güvenlik,
veritabanı standardizasyonu, kalite, iç CRM ürünleştirme, operasyon otomasyonu
ve gerçek dış sağlayıcı entegrasyonları olmak üzere sıralı fazlarla
geliştirilmiştir.

20 Ağustos 2026 denetim başlangıcında doğrulanan GitHub durumu:

- `main` dalında 70 commit;
- 56 birleştirilmiş pull request;
- 1 birleştirilmeden kapatılmış ve sonraki paketle yenilenmiş pull request
  (#62);
- 0 açık pull request ve 0 açık issue;
- Faz 4 milestone'unda 10 kapalı, 0 açık issue;
- son ana dal Quality Gates koşusu #32260397606 başarılı.

Production liveness ve readiness uçları HTTP 200'dür. Faz 5.0–5.6 gerçek
production kabulünden geçmiştir. Faz 5.7 bu denetim paketinde yerel yayın
adayıdır; public `/login`, `/privacy-policy` ve `/terms` sayfaları paket
yayınlanmadan önce production'da 404 dönmektedir. Bu ayrım, yerel hazırlığın
yanlışlıkla GitHub veya production tamamlanması olarak raporlanmaması için
bilinçli olarak korunur.

## 2. Ürün ve mimari sınırı

Sistem Nobel Vize'nin tek şirketli iç operasyon CRM'idir. Güncel ana teknik
yapı:

- Next.js 16 App Router ve React 19 arayüzü;
- Supabase PostgreSQL, Auth, RLS ve private Storage;
- Vercel production yayını ve zamanlanmış görevler;
- Resend ile gerçek e-posta ve teslim/bounce webhook'ları;
- Google ile yalnız kayıtlı aktif personel girişi;
- Google Calendar ile CRM'e bağlı randevuların iki yönlü eşitlemesi;
- GitHub Actions üzerinde application, database ve browser kalite kapıları.

Çok kiracılı SaaS, abonelik, paket, kota, white-label ve self-service ücretli
onboarding yapılmamıştır. Bu, eksiklik değil; tek şirket ihtiyacına göre
verilmiş ve ADR ile korunan ürün kararıdır.

## 3. Kronolojik gelişim

### 3.1 İlk sürümler — Haziran ve Temmuz 2026

İlk CRM sürümü müşteri, başvuru, evrak, ödeme, personel, log ve yedekleme
temellerini kurdu. Kosmosvize modelinden esinlenen profil tabanlı evrak seçimi,
başvuru takibi ve dashboard ilk ürün kapsamındaydı. Sonraki denetimde güvenlik,
veri bütünlüğü ve production kabulünün sistematik fazlara ayrılması gerektiği
görüldü.

### 3.2 Faz 0 — Güvenlik ve veri koruma

20 Temmuz 2026'da PR #1 ile:

- personel ve admin erişimi fail-closed hale getirildi;
- sayfa/API rol kontrolleri ve recursion üretmeyen RLS kuruldu;
- Google Form webhook'u imza, zaman ve tekrar saldırısı koruması aldı;
- müşteri portalı sunucu tarafına, belgeler private Storage'a taşındı;
- güvenli personel daveti, restore koruması ve temel güvenlik başlıkları eklendi.

Sonuç: Production veri erişiminin güvenlik temeli kuruldu.

### 3.3 Faz 1 — Veritabanı standardizasyonu

20 Temmuz 2026'da PR #2 ile:

- sürümlü Supabase migration zinciri;
- foreign key, check ve indeks standardı;
- ülke/vize kuralının kanonik veri modeli;
- kritik müşteri/başvuru işlemlerinde atomik RPC;
- sürümlü backup/restore ve PostgreSQL testleri uygulandı.

Sonuç: Şema ve kritik iş akışları tekrarlanabilir yayın disiplinine alındı.

### 3.4 Faz 2 — Stabilizasyon ve kalite

20 Temmuz 2026'da PR #3 ile:

- dashboard ve rapor hesapları düzeltildi;
- Supabase üretimli TypeScript tipleri ve lint temizliği tamamlandı;
- birim, güvenlik, PostgreSQL ve Playwright kontrolleri kuruldu;
- GitHub Actions application/database/browser kalite kapıları oluşturuldu;
- production dependency audit eklendi, güvensiz XLSX bağımlılığı kaldırıldı.

Sonuç: Sonraki fazların ölçülebilir kalite kapısı oluştu.

### 3.5 Faz 3 — İç CRM ürünleştirme

20–26 Temmuz 2026 arasında PR #4–#30 ile sıralı olarak:

- Faz 3.1: staging/production hazırlığı ve migration kabulü;
- Faz 3.2: tek şirket arayüzü ve şema temizliği;
- production Staff/Auth ve RLS olayı için kontrollü hotfix;
- Acil Paket H2: geri yüklenebilir müşteri arşivi ve kontrollü kalıcı silme;
- Faz 3.3: görevler, kişisel bildirimler ve operasyon hatırlatmaları;
- Faz 3.4: süreç panosu, profil alanları, etiketler, hızlı eylemler ve timeline;
- Faz 3.5: izin denetimli iletişim outbox'ı ve kontrollü müşteri portalı;
- Faz 3.6: KVKK kayıtları, talepler, saklama ve veri yaşam döngüsü;
- Faz 3.7: request ID, güvenli loglar, health/readiness, uyarılar, yedek ve
  izole restore tatbikatı;
- Faz 3.8: rol izolasyonu, kritik/kenar akış, responsive, erişilebilirlik,
  performans, RLS, migration, UAT ve production kapanışı tamamlandı.

Sonuç: CRM günlük iç operasyon kullanımına uygun production tabanına ulaştı.

### 3.6 Faz 4 — Operasyon otomasyonu ve CRM iyileştirmeleri

26 Temmuz–2 Ağustos 2026 arasında:

- Faz 4.0: plan, kabul ölçütleri, issue ve milestone yapısı kuruldu;
- Faz 4.1: gerçek veriye dayanmayan “AI Profil Analizi” ve müşteri puanı
  uygulama, rapor, export ve veritabanından kaldırıldı;
- Faz 4.1.1: boş evrak eşleştirme, tema, etiket, görev yükleme, eksik veri
  görünürlüğü ve mükerrer müşteri koruması düzeltildi;
- Faz 4.2: Vercel Cron ile kullanıcı sayfa açmadan görev üretimi;
- Faz 4.3: otomatik şifreli DB/Storage recovery point ve doğrulama;
- Faz 4.4: rol bazlı TOTP/MFA, giriş kilidi ve oturum yönetimi;
- Faz 4.5: izin/outbox/webhook temeli; gerçek sağlayıcı Faz 5.2'ye ertelendi;
- Faz 4.6: dry-run, hukuki saklama, çift onay ve yedek kapılı KVKK otomasyonu;
- Faz 4.7: lead, kaynak/kampanya, SLA, mükerrer ve kontrollü dönüşüm;
- Faz 4.8: randevu çakışması, durum geçmişi, ICS ve gerçek CSV/PDF raporlar;
- Faz 4.9: bakım, kabul ve production kapanış kapıları tamamlandı.

2 Ağustos 2026'da gerçek admin TOTP etkin/zorunlu olarak doğrulandı, diğer iki
oturum kapatıldı ve yeniden giriş/MFA kabulü geçti. Issue #34, #35 ve #39 ile
Faz 4 milestone'u bundan sonra kapatıldı.

### 3.7 Faz 5.0 — Temizlik ve dürüst Faz 4 kapanışı

- Kanonik dosyalarla byte düzeyinde aynı 15 izlenmeyen ` 2` adlı kopya,
  hedefleri tek tek doğrulandıktan sonra temizlendi.
- Dependabot PR #49 ve #50 beklenen head ve kontrollerle sırayla birleştirildi.
- #50 sonrasında Supabase/Inbucket `54324` port çakışması bulundu; browser işi
  database işinden sonra çalışacak şekilde PR #51 ile düzeltildi.
- Yerel, GitHub PR, ana dal CI, production ve gerçek kullanıcı kabulü ayrı
  kanıtlandı.

Sonuç: Faz 4 teknik olarak değil, gerçek admin kabulüyle kapatıldı.

### 3.8 Faz 5.1 — Veri kalitesi ve şirket doğrulaması

- Eksik müşteri/başvuru alanları için sorumlu atanabilen, idempotent ve veri
  tamamlanınca kapanan görev kuyruğu production'a alındı.
- Eksik veri otomatik tahmin edilmedi veya yazılmadı.
- Şirket adı/e-posta/telefonu yalnız admin kontrollü doğrulama akışına alındı.
- `bilgi@nobelvize.com` ve `+90 533 499 57 50`, 19 Ağustos 2026'da resmî
  Nobel Vize iletişim sayfası kaynak gösterilerek production'da doğrulandı.

### 3.9 Faz 5.2 — Gerçek e-posta

- Resend adaptörü, idempotent outbox teslimi, imzalı delivery/bounce webhook'u,
  retry ve izin/ret denetimi production'a alındı.
- 19 Ağustos 2026 canlı kabul iletisi `delivered` durumuna geldi; son hata kodu
  bulunmadı.
- WhatsApp Business ikinci sağlayıcı olarak açılmadı; 20 Ağustos ürün kararıyla
  açıkça ertelendi.

### 3.10 Faz 5.3 — Gerçek operasyon entegrasyonları

- Google Calendar için şifreli token, imzalı OAuth state, günlük cron ve bağlı
  CRM randevularında iki yönlü eşitleme;
- private Storage'a imzalı ve tür/boyut kontrollü portal evrak yükleme;
- danışman kapasite/iş yükü limitleri;
- son tarihli tahsilat ve geciken ödeme görevleri production'a alındı.

Google ile personel girişi PR #65 ile canlıya çıktı. İlk canlı Takvim kabulünde
uzak değişikliğin dışa aktarım tarafından ezildiği bulundu. PR #66, önce uzaktaki
değişikliği içeri alıp sonra güncel CRM görünümünü dışa göndererek problemi
kapattı. Tekrar kabulde Google'da değiştirilen saat/konum CRM'e `rescheduled`
olarak döndü ve korunarak yeniden eşitlendi.

### 3.11 Faz 5.4–5.5 — Kaynaklı ülke/vize evrak omurgası

- Resmî/ikincil kaynak, kontrol tarihi, yeniden kontrol tarihi ve kaynak durumu
  kural modeline eklendi.
- Genel evrak listesi ile müşteri profil ekleri katmanlı modele ayrıldı.
- İlk paket Almanya, Fransa ve İtalya için 12 genel liste ve 91 profil ekiyle
  production'a alındı.
- Almanya iş seyahati doğrulandı; Fransa turistik/öğrenci kesin Visa Assistant
  çıktıları ve İtalya güncel ticari liste yeniden doğrulama kuyruğundadır.

### 3.12 Faz 5.6 — Gerçek sağlayıcı canlı kabulü

19 Ağustos 2026'da şirket iletişimi, Resend delivery webhook'u, Google ile
giriş ve Google Takvim gidiş-dönüş senaryosu canlıda doğrulandı. Kullanılan
sentetik müşteri arşivlendi, test randevusu iptal edildi ve Google etkinliği
kaldırıldı. Canlı yöneticinin çalışan Google bağlantısı korunmuştur.

### 3.13 Faz 5.7 — Google doğrulama hazırlığı

20 Ağustos 2026 yerel yayın adayında:

- giriş ekranından ayrı public ürün ana sayfası;
- public gizlilik politikası ve kullanım şartları;
- personel girişi için `/login`;
- `calendar.events` yerine daha dar `calendar.events.owned` izni;
- tüm takvimi listelemek yerine yalnız CRM bağlantılı event kimliklerini okuma;
- Google revoke ve yerel şifreli bağlantı/eşleme temizliği;
- bağlama öncesi veri açıklaması ve kaldırma öncesi açık onay eklendi.

Bu adayın yerel tam kabulünde lint, tip denetimi, 82 uygulama testi, production
audit, build, veritabanı lint'i, 433 PostgreSQL testi ve 31 Chromium senaryosu
geçmiştir. GitHub/production durumu rapor kesiminden sonra ayrıca kanıtlanır.

## 4. 20 Ağustos 2026 doğrulanmış durum matrisi

| Alan | Durum | Kanıt / sınır |
|---|---|---|
| GitHub ana dal | Sağlıklı | `6839d10`, son Quality Gates #32260397606 başarılı |
| Açık işler | GitHub'da yok | 0 açık PR, 0 açık issue; yeni yol haritası henüz issue'laştırılmadı |
| Production health | Sağlıklı | `/api/health/live` ve `/api/health/ready` HTTP 200 |
| Veritabanı | Sürümlü | Repository'de 45 migration ve 14 PostgreSQL test dosyası |
| Uygulama güvenliği | Aktif | RLS, rol kontrolü, MFA, giriş limiti, oturum yönetimi, audit |
| E-posta | Canlı | Resend gerçek delivery webhook'u 19 Ağustos'ta doğrulandı |
| Google ile giriş | Canlı | Yalnız aktif staff kaydı + MFA politikası |
| Google Takvim | Canlı | İki yönlü kabul geçti; çalışan bağlantı korunuyor |
| Public hukuk sayfaları | Yayın adayı | Rapor kesiminde `/login`, `/privacy-policy`, `/terms` production'da 404 |
| Google hassas kapsam doğrulaması | Açık dış iş | Branding, Data Access, video ve başvuru tamamlanmalı |
| WhatsApp Business | Ertelendi | Sağlayıcı hesabı/webhook/ücretli otomatik teslim açılmayacak |
| Çok kiracılı SaaS | Kapsam dışı | Tek şirket ürün kararı devam ediyor |

## 5. GitHub issue ve milestone kapanışı

Faz 4 milestone'u 2 Ağustos 2026'da 10 kapalı, 0 açık issue ile kapanmıştır:

| Issue | Konu | Sonuç |
|---|---|---|
| #31 | Yanıltıcı müşteri puanlaması | Kaldırıldı |
| #32 | Zamanlanmış operasyon | Production'a alındı |
| #33 | Şifreli DB/Storage yedeği | Production kabulü tamamlandı |
| #34 | MFA, giriş ve oturum | Gerçek admin kabulüyle kapandı |
| #35 | Gerçek bildirim | Temel tamamlandı; gerçek e-posta Faz 5.2'de canlıya alındı |
| #36 | KVKK otomasyonu | Production'a alındı |
| #37 | Lead/müşteri operasyonu | Production'a alındı |
| #38 | Takvim ve raporlar | Temel tamamlandı; Google Faz 5.3/5.6'da canlıya alındı |
| #39 | Tam kabul ve kapanış | MFA kanıtından sonra kapandı |
| #43 | Stabilizasyon/veri bütünlüğü | PR #44 ile kapandı |

## 6. Pull request dökümü

Bu tablo repository'deki tüm PR kayıtlarını tek tek gösterir. #31–#39 ve #43
PR değil, yukarıdaki Faz 4 issue numaralarıdır.

| PR | Tarih | Sonuç / başlık |
|---|---|---|
| [#1](https://github.com/abidinyldz06/nobel-vize-crm/pull/1) | 20 Tem | Secure phase 0 access and data flows |
| [#2](https://github.com/abidinyldz06/nobel-vize-crm/pull/2) | 20 Tem | Standardize database workflows |
| [#3](https://github.com/abidinyldz06/nobel-vize-crm/pull/3) | 20 Tem | Stabilize metrics and quality gates |
| [#4](https://github.com/abidinyldz06/nobel-vize-crm/pull/4) | 20 Tem | Start Phase 3 production readiness |
| [#5](https://github.com/abidinyldz06/nobel-vize-crm/pull/5) | 21 Tem | Phase 3.1 migration readiness |
| [#6](https://github.com/abidinyldz06/nobel-vize-crm/pull/6) | 21 Tem | Phase 3.1 production rollout |
| [#7](https://github.com/abidinyldz06/nobel-vize-crm/pull/7) | 21 Tem | Tek şirket ayarları |
| [#8](https://github.com/abidinyldz06/nobel-vize-crm/pull/8) | 21 Tem | Faz 3.2 production doğrulaması |
| [#9](https://github.com/abidinyldz06/nobel-vize-crm/pull/9) | 21 Tem | Production Staff/Auth güvenlik düzeltmesi |
| [#10](https://github.com/abidinyldz06/nobel-vize-crm/pull/10) | 21 Tem | Staff/Auth hotfix sonucu |
| [#11](https://github.com/abidinyldz06/nobel-vize-crm/pull/11) | 22 Tem | Güvenli müşteri arşiv yaşam döngüsü |
| [#12](https://github.com/abidinyldz06/nobel-vize-crm/pull/12) | 22 Tem | H2 production kapanışı |
| [#13](https://github.com/abidinyldz06/nobel-vize-crm/pull/13) | 22 Tem | Görev ve gerçek bildirim sistemi |
| [#14](https://github.com/abidinyldz06/nobel-vize-crm/pull/14) | 22 Tem | Faz 3.3 production raporu |
| [#15](https://github.com/abidinyldz06/nobel-vize-crm/pull/15) | 22 Tem | Başvuru ve müşteri operasyonu |
| [#16](https://github.com/abidinyldz06/nobel-vize-crm/pull/16) | 22 Tem | Production oturum yönlendirmesi |
| [#17](https://github.com/abidinyldz06/nobel-vize-crm/pull/17) | 22 Tem | Başvuru-müşteri ilişkisinin tekilleştirilmesi |
| [#18](https://github.com/abidinyldz06/nobel-vize-crm/pull/18) | 22 Tem | Faz 3.4 production raporu |
| [#19](https://github.com/abidinyldz06/nobel-vize-crm/pull/19) | 22 Tem | Müşteri iletişimi ve portal |
| [#20](https://github.com/abidinyldz06/nobel-vize-crm/pull/20) | 22 Tem | Faz 3.5 production kapanışı |
| [#21](https://github.com/abidinyldz06/nobel-vize-crm/pull/21) | 22 Tem | KVKK ve veri yaşam döngüsü |
| [#22](https://github.com/abidinyldz06/nobel-vize-crm/pull/22) | 22 Tem | Faz 3.6 production kapanışı |
| [#23](https://github.com/abidinyldz06/nobel-vize-crm/pull/23) | 26 Tem | İzleme ve iş sürekliliği |
| [#24](https://github.com/abidinyldz06/nobel-vize-crm/pull/24) | 26 Tem | Faz 3.7 production kapanışı |
| [#25](https://github.com/abidinyldz06/nobel-vize-crm/pull/25) | 26 Tem | Kabul matrisi ve rol izolasyonu |
| [#26](https://github.com/abidinyldz06/nobel-vize-crm/pull/26) | 26 Tem | Kritik ve kenar akış kabulü |
| [#27](https://github.com/abidinyldz06/nobel-vize-crm/pull/27) | 26 Tem | Responsive, erişilebilirlik, performans |
| [#28](https://github.com/abidinyldz06/nobel-vize-crm/pull/28) | 26 Tem | Kalite ve production kapanışı |
| [#29](https://github.com/abidinyldz06/nobel-vize-crm/pull/29) | 26 Tem | Production RLS drift düzeltmesi |
| [#30](https://github.com/abidinyldz06/nobel-vize-crm/pull/30) | 26 Tem | Production giriş kontrolü düzeltmesi |
| [#40](https://github.com/abidinyldz06/nobel-vize-crm/pull/40) | 26 Tem | Faz 4 yol haritası ve GitHub iş listesi |
| [#41](https://github.com/abidinyldz06/nobel-vize-crm/pull/41) | 26 Tem | Yanıltıcı müşteri puanlamasının kaldırılması |
| [#42](https://github.com/abidinyldz06/nobel-vize-crm/pull/42) | 26 Tem | Faz 4.1 production kapanışı |
| [#44](https://github.com/abidinyldz06/nobel-vize-crm/pull/44) | 28 Tem | Stabilizasyon ve veri bütünlüğü |
| [#45](https://github.com/abidinyldz06/nobel-vize-crm/pull/45) | 28 Tem | Otomasyon, yedek ve hesap güvenliği |
| [#46](https://github.com/abidinyldz06/nobel-vize-crm/pull/46) | 28 Tem | Production yedek hotfix |
| [#47](https://github.com/abidinyldz06/nobel-vize-crm/pull/47) | 28 Tem | Faz 4.2–4.3 production kapanışı |
| [#48](https://github.com/abidinyldz06/nobel-vize-crm/pull/48) | 28 Tem | KVKK, lead, takvim ve release güvenliği |
| [#49](https://github.com/abidinyldz06/nobel-vize-crm/pull/49) | 29 Tem | actions/checkout v7 güncellemesi |
| [#50](https://github.com/abidinyldz06/nobel-vize-crm/pull/50) | 29 Tem | actions/setup-node v7 güncellemesi |
| [#51](https://github.com/abidinyldz06/nobel-vize-crm/pull/51) | 29 Tem | Faz 5.0 CI stabilizasyonu |
| [#52](https://github.com/abidinyldz06/nobel-vize-crm/pull/52) | 2 Ağu | Faz 4 MFA kabul kapanışı |
| [#53](https://github.com/abidinyldz06/nobel-vize-crm/pull/53) | 2 Ağu | Veri kalite görev kuyruğu |
| [#54](https://github.com/abidinyldz06/nobel-vize-crm/pull/54) | 2 Ağu | Şirket iletişim doğrulaması |
| [#55](https://github.com/abidinyldz06/nobel-vize-crm/pull/55) | 2 Ağu | İletişim, portal ve operasyon altyapısı |
| [#56](https://github.com/abidinyldz06/nobel-vize-crm/pull/56) | 2 Ağu | Faz 5.2–5.3 production kapanışı |
| [#57](https://github.com/abidinyldz06/nobel-vize-crm/pull/57) | 6 Ağu | Patch/minor bağımlılık güncellemesi |
| [#58](https://github.com/abidinyldz06/nobel-vize-crm/pull/58) | 6 Ağu | Kaynaklı ülke/vize kural kataloğu |
| [#59](https://github.com/abidinyldz06/nobel-vize-crm/pull/59) | 6 Ağu | Faz 5.4 production kapanışı |
| [#60](https://github.com/abidinyldz06/nobel-vize-crm/pull/60) | 6 Ağu | Katmanlı ülke ve evrak kataloğu |
| [#61](https://github.com/abidinyldz06/nobel-vize-crm/pull/61) | 6 Ağu | Faz 5.5 production kapanışı |
| [#62](https://github.com/abidinyldz06/nobel-vize-crm/pull/62) | 17 Ağu | **Birleştirilmeden kapandı:** güncel bağımlılık paketi #63 ile yenilendi |
| [#63](https://github.com/abidinyldz06/nobel-vize-crm/pull/63) | 19 Ağu | 11 patch/minor bağımlılık güncellemesi |
| [#64](https://github.com/abidinyldz06/nobel-vize-crm/pull/64) | 19 Ağu | Next.js navigation düzeltmesi |
| [#65](https://github.com/abidinyldz06/nobel-vize-crm/pull/65) | 19 Ağu | Güvenli Google personel girişi |
| [#66](https://github.com/abidinyldz06/nobel-vize-crm/pull/66) | 19 Ağu | Google Takvim değişikliklerini koruyan eşitleme |
| [#67](https://github.com/abidinyldz06/nobel-vize-crm/pull/67) | 19 Ağu | Faz 5.6 canlı kabul kaydı |

## 7. Öğrenilen önemli dersler

- **Durum katmanları ayrılmalı:** Yerel commit, GitHub push, PR, ana dal CI,
  deployment ve gerçek kullanıcı kabulü aynı şey değildir.
- **Canlı kabul teknik sağlık kontrolünden farklıdır:** MFA ancak gerçek admin
  enrollment, diğer oturumları kapatma ve yeniden girişle kapandı.
- **Bağımlılık PR'ları sırayla ilerlemeli:** Aynı Supabase portunu kullanan
  paralel işler yeşil kodu kırmızı CI gibi gösterebilir.
- **İki yönlü senkronizasyonda sıra ürün davranışıdır:** Google değişikliği
  önce içeri alınmadan CRM'in dışa yazması uzak değişikliği ezmiştir.
- **Eksik veri tahmin edilmemeli:** Veri kalite kuyruğu, hatalı otomatik
  doldurmadan daha güvenli ve denetlenebilir çözümdür.
- **Resmî kaynak önceliklidir:** Ülke evrak kuralı kaynaksız veya tarihi geçmiş
  olduğunda doğrulanmış kabul edilmez.
- **Dış sağlayıcı yönetişimi koddan ayrıdır:** Çalışan OAuth entegrasyonu,
  Branding ve sensitive-scope verification tamamlandı anlamına gelmez.

## 8. Açık kalan işler

1. Faz 5.7 paketini GitHub PR, ana dal CI ve production kanıtıyla yayınlamak.
2. Google Cloud Branding ve Data Access alanlarını yeni public URL/kapsamla
   güncellemek.
3. Ayrı test kullanıcısıyla Unlisted İngilizce demo hazırlayıp hassas kapsam
   doğrulamasına başvurmak.
4. Fransa ve İtalya bekleyen ülke/vize kural doğrulamalarını tamamlamak.
5. Veri kalite kuyruğunu gerçek operasyon haftasıyla ölçmek.
6. Yedek tazeliği, Storage binary sürekliliği ve izole restore tatbikatını
   periyodik yönetişim döngüsüne almak.

Ayrıntılı sıra ve kabul ölçütleri `PROJECT_ROADMAP_FROM_2026_08_20.md`
dosyasındadır.
