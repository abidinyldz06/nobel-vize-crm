# Faz 4 — Operasyon Otomasyonu ve CRM İyileştirmeleri

Tarih: 26 Temmuz 2026

Durum: Faz 4.1 tamamlandı; Faz 4.1.1 ve Faz 4.2–4.4 release adayı; Faz 4.5
sağlayıcı-bağımsız temeli hazır, gerçek sağlayıcı kararı bekliyor.

Ön koşul: Faz 3.8 production kapanışı tamamlandı (`3a4d66c`).

## 1. Ürün kararı ve kapsam

Faz 4, Nobel Vize'nin tek şirketli iç CRM'ini daha güvenilir, otomatik ve
ölçülebilir hale getirir. SaaS/tenant, abonelik, plan, kota, faturalandırma,
white-label ve subdomain özellikleri bu fazın kapsamı dışındadır.

Bu fazın ilk ürün kararı, müşteriye 0–100 arasında değer veren
`profile_score` sisteminin tamamen kaldırılmasıdır. Mevcut sistem sabit
kurallarla hesaplanmakta, arayüzde "AI Profil Analizi" olarak sunulmakta ve
rapor ekranında gerçek veriden üretilmeyen onay yüzdeleri göstermektedir.
Müşteri veya başvuru kararı bu tür bir puanla temsil edilmeyecektir.

Korunacak yapılar:

- gerçek başvuru sonuçlarından hesaplanan onay/red oranları;
- ülke ve vize türü bazlı geçmiş performans raporları;
- müşteri puanı üretmeyen, yalnız en uygun evrak kuralını seçen teknik
  eşleştirme mantığı.

## 2. Çalışma ve yayın ilkeleri

Her alt aşama aşağıdaki sırayla yürütülür:

1. Aşama başlamadan kapsam ve riskler kullanıcıya bildirilir.
2. Kod, migration, test ve doküman değişiklikleri aynı aşamada tamamlanır.
3. İlgili hedefli kontroller çalıştırılır.
4. Aşama açıkça `4.x BİTTİ` olarak raporlanır.
5. Değişiklikler kontrol edilmeden commit veya push yapılmaz.
6. Migration içeren paketler production öncesinde yedek, dry-run, staging ve
   geri dönüş adımlarına bağlanır.
7. Bir aşamanın production kanıtı tamamlanmadan GitHub kaydı kapatılmaz.

## 3. Alt aşamalar

### 4.0 — Plan, kabul kriterleri ve GitHub iş listesi

Kapsam:

- bu plan belgesinin oluşturulması;
- README ve yaşayan teknik yol haritasının güncellenmesi;
- Faz 4 milestone ve sıralı GitHub issue kayıtlarının oluşturulması;
- her alt aşamanın bağımlılık, kapsam dışı ve kabul kriterlerinin belirlenmesi.

Kabul kriterleri:

- [x] `docs/PHASE_4_PLAN.md` tüm alt aşamaları ve kabul kriterlerini içerir.
- [x] README Faz 4 durumunu ve plan bağlantısını gösterir.
- [x] Teknik yol haritası, 20 Temmuz başlangıç bulguları yerine güncel durumu
      gösterir.
- [x] GitHub'da tek Faz 4 milestone'u ve 4.1–4.9 için sıralı issue'lar vardır.
- [x] Issue kapsamları bu belgedeki sınırlarla çelişmez.
- [x] Doküman diff'i ve bağlantılar doğrulanır.

### 4.1 — Yanıltıcı müşteri puanlamasının kaldırılması

Kapsam:

- `ProfileAnalysisButton` ve `ProfileAnalysisModal` arayüzlerinin kaldırılması;
- müşteri liste, kart, detay ve CSV çıktılarından profil skorunun çıkarılması;
- müşteri oluşturma, güncelleme, import, Google Form webhook ve evrak onayında
  skor hesaplama/yazma davranışının kaldırılması;
- sabit `%98`, `%76`, `%34` değerleri gösteren profil skoru raporunun
  kaldırılması ve yerine gerçek operasyon verisinin kullanılması;
- yeni migration ile `customers.profile_score` kolonu ve doğrulama
  constraint'inin kaldırılması;
- müşteri oluşturma/güncelleme ve anonimleştirme RPC'lerinin yeni şemaya
  uyarlanması;
- üretilen veritabanı tipleri, şema anlık görüntüleri, testler ve yedek/restore
  uyumluluğunun güncellenmesi;
- evrak kuralı seçicisinin müşteri puanlaması olmadığı kodda açık hale
  getirilmesi.

Kapsam dışı:

- gerçek vize onay/red istatistiklerinin kaldırılması;
- geçmiş audit kayıtlarının silinmesi;
- yeni bir alternatif müşteri skoru geliştirilmesi.

Kabul kriterleri:

- [x] Uygulamada "AI Profil Analizi", "Profil Skoru" veya müşteri `/100`
      göstergesi kalmaz.
- [x] Kaynak kodda `profile_score` okuma/yazma yolu kalmaz.
- [x] Yeni kurulum ve upgrade migration zinciri başarıyla çalışır.
- [x] Eski v2 yedek girdilerindeki fazladan skor alanı geri yüklemeyi bozmaz
      veya açık bir sürüm dönüşümüyle güvenle yok sayılır.
- [x] Raporlar yalnız veritabanındaki gerçek sonuç ve operasyon verilerini
      gösterir.
- [x] Lint, typecheck, birim, güvenlik, pgTAP, Playwright ve build kapıları
      başarılıdır.

### 4.1.1 — Stabilizasyon ve veri bütünlüğü

Kapsam:

- boş profil alanlarında evrak kuralı seçimi ve frontend/DB eşleştirme uyumu;
- açık tema, ana etiket kataloğu ve görev ilk yükleme görünürlüğü;
- eksik başvuru bilgisi filtresi ve yeni kayıtlarda zorunlu profil alanları;
- normalize telefon, e-posta ve pasaportla atomik mükerrer müşteri koruması;
- doğrulanmış ALPER ORS kaydının hard delete olmadan birleştirilmesi;
- şirket iletişim verisi boşken görünür ayar uyarısı;
- birim, pgTAP, Playwright ve release regresyonları.

Kapsam dışı:

- geçmiş başvurulara tahmini profil verisi yazılması;
- gerçek şirket telefonu veya e-postasının ürün sahibi yerine uydurulması;
- doğrulanmış kaynağı olmayan ülke/evrak kurallarının otomatik üretilmesi;
- kullanıcı etkileşiminden bağımsız görev cron'u (Faz 4.2).

Kabul kriterleri:

- [x] Kod, migration, test ve rapor paketi hazırdır.
- [x] Production öncesi şifreli DB/Auth/Storage yedeği doğrulanmıştır.
- [x] Yerel tam `release:verify` kapısı başarılıdır.
- [ ] GitHub PR ve CI kapıları başarılıdır.
- [ ] Migration production'a uygulanmış ve canlı akış doğrulanmıştır.

Rapor: `docs/PHASE_4_1_1_IMPLEMENTATION_REPORT.md`

### 4.2 — Zamanlanmış operasyon sistemi

Uygulama durumu: Kod, migration ve test kapsamı hazır; toplu kalite kapısı,
GitHub CI ve production kabulü bekliyor.

Kapsam:

- Vercel Cron tarafından çağrılan, secret ile korunan sunucu endpoint'i;
- pasaport, randevu, eksik evrak, bekleyen ödeme ve hareketsiz başvuru
  görevlerinin kullanıcı sayfa açmadan senkronize edilmesi;
- idempotency, eşzamanlı çalışma kilidi, çalışma geçmişi ve hata bildirimi;
- cron çağrısında kişisel veri veya secret loglanmaması.

Kabul kriterleri:

- [ ] Yetkisiz cron isteği reddedilir.
- [ ] Aynı zaman aralığı iki kez işlendiğinde yinelenen görev oluşmaz.
- [ ] Başarılı ve başarısız çalışmalar güvenli operasyon kaydına yazılır.
- [ ] Görev ekranı hiç açılmadan vadesi gelen görevler oluşur.
- [ ] Unit, güvenlik, pgTAP ve zamanlanmış iş entegrasyon testleri başarılıdır.

### 4.3 — Otomatik, şifreli ve repo dışı yedekleme

Uygulama durumu: Kod, migration, retention ve restore uyumluluğu hazır; toplu
kalite kapısı ve production ilk zamanlanmış recovery point kanıtı bekliyor.

Kapsam:

- veritabanı ve private Storage binary'lerinin zamanlanmış yedeği;
- repo dışı hedefte şifreli saklama;
- günlük, haftalık ve aylık retention politikası;
- SHA-256 doğrulaması, başarısızlık uyarısı ve restore tatbikatı;
- secret ve kişisel verinin CI/log çıktısına yazılmaması.

Kabul kriterleri:

- [ ] Veritabanı ile Storage nesneleri aynı recovery point kaydına bağlanır.
- [ ] Yedek şifreli, bütünlüğü doğrulanmış ve repo dışındadır.
- [ ] Saklama politikası otomatik uygulanır.
- [ ] Başarısız veya gecikmiş yedek admin uyarısı üretir.
- [ ] İzole restore tatbikatı veri ve Storage bütünlüğünü doğrular.

### 4.4 — Hesap ve giriş güvenliğinin güçlendirilmesi

Uygulama durumu: Kod, migration ve test kapsamı hazır; production admin MFA
enrollment ve oturum iptal kabulü bekliyor.

Kapsam:

- admin için zorunlu, personel için politika ile yönetilen MFA/TOTP;
- giriş denemesi sınırlaması, gecikme ve geçici kilitleme;
- aktif oturum/cihaz görüntüleme ve diğer oturumları kapatma;
- şüpheli giriş, MFA ve oturum işlemleri için güvenli audit izi.

Kabul kriterleri:

- [ ] MFA politikası rol bazında zorlanır ve kurtarma akışı belgelenir.
- [ ] Tekrarlı başarısız girişler sınırlanır.
- [ ] Oturum sonlandırma sonraki korumalı istekte etkili olur.
- [ ] Güvenlik olaylarında token, secret veya parola loglanmaz.
- [ ] Admin/danışman/anonim regresyon testleri başarılıdır.

### 4.5 — Sağlayıcı destekli gerçek bildirim ve iletişim

Uygulama durumu: İzin, outbox, retry ve imzalı webhook temeli hazırdır.
Başlangıç kapısı nedeniyle gerçek provider adaptörü ve sandbox testi
başlatılmamıştır.

Başlangıç kapısı:

- sağlayıcı, maliyet, gönderici alan adı/numarası ve hukuki iletişim politikası
  ürün sahibi tarafından seçilmeden uygulama başlamaz.

Kapsam:

- e-posta ve onaylanırsa WhatsApp Business sağlayıcı entegrasyonu;
- sunucu tarafı outbox/kuyruk, idempotency ve kontrollü retry;
- webhook ile gönderildi/teslim/başarısız durumları;
- şablon, iletişim izni, ret ve audit kaydı;
- mevcut `mailto:`/`wa.me` akışının kontrollü fallback olarak değerlendirilmesi.

Kabul kriterleri:

- [ ] Uygulama sağlayıcı kabulü olmadan teslim edildi iddiasında bulunmaz.
- [ ] Yinelenen istek aynı mesajı iki kez göndermez.
- [ ] Webhook imzası ve tekrar saldırısı koruması vardır.
- [ ] Ret veya iletişim izni olmayan kanala gönderim engellenir.
- [ ] Sağlayıcı sandbox E2E testi ve hata/retry senaryosu başarılıdır.

### 4.6 — Kontrollü KVKK yaşam döngüsü otomasyonu

Kapsam:

- silme/anonimleştirme adayları için dry-run raporu;
- saklama kilidi ve yasal bekletme kontrolü;
- admin onay kuyruğu ve gerektiğinde çift kontrol;
- yedek doğrulaması sonrası zamanlanmış uygulama;
- değiştirilemez privacy audit kaydı.

Kabul kriterleri:

- [ ] Varsayılan davranış veri değiştirmeyen dry-run'dır.
- [ ] Kilitli veya hukuken bekletilen kayıt işlenmez.
- [ ] Onaysız kalıcı silme yapılamaz.
- [ ] Storage temizliği tamamlanmadan müşteri kaydı sonuçlandırılmaz.
- [ ] Her karar, aktör, zaman ve gerekçeyle audit kaydına yazılır.

### 4.7 — Lead ve müşteri operasyonlarının geliştirilmesi

Kapsam:

- lead ve aktif müşteri yaşam döngüsü;
- kaynak, kampanya ve yönlendirme takibi;
- normalize telefon/e-posta/pasaport ile mükerrer kayıt tespiti;
- kontrollü personel atama, takip SLA'sı ve kaçırılan takip uyarısı;
- lead dönüşüm hunisi ve danışman performansı.

Kabul kriterleri:

- [ ] Lead, başvuru müşterisine veri kaybetmeden dönüştürülebilir.
- [ ] Mükerrer eşleşme açıklanabilir ve kullanıcı onayı olmadan kayıt birleştirmez.
- [ ] Danışman yalnız yetkili olduğu lead/müşteri kayıtlarını görür.
- [ ] SLA uyarıları Faz 4.2 zamanlayıcısını yeniden kullanır.
- [ ] Dönüşüm raporu gerçek yaşam döngüsü kayıtlarından hesaplanır.

### 4.8 — Takvim entegrasyonu ve gelişmiş gerçek raporlar

Kapsam:

- ilk teslimde ICS; ürün kararı verilirse Google/Outlook takvim bağlantısı;
- randevu çakışması, iptal, erteleme ve gelmedi durumları;
- ülke/vize sonucu, tahsilat yaşlandırma, SLA ve iş yükü raporları;
- raporların filtre, boş durum ve zaman dilimi doğruluğu.

Kabul kriterleri:

- [ ] Takvim çıktısı doğru saat dilimi ve randevu bilgisi üretir.
- [ ] Çakışma uyarısı yetki sınırlarını aşmadan çalışır.
- [ ] Raporlarda sabit veya tahmini başarı yüzdesi bulunmaz.
- [ ] Tüm metrikler kanonik tablolardan ve seçili dönemden hesaplanır.
- [ ] CSV/PDF çıktıları ekrandaki filtrelerle tutarlıdır.

### 4.9 — Bakım, kabul ve production kapanışı

Kapsam:

- uyumlu patch/minor bağımlılık güncellemeleri;
- Dependabot ve zamanlanmış production dependency audit;
- uyumluluk kanıtı olmadan ESLint 10, TypeScript 7 veya Node tip ana sürüm
  geçişi yapılmaması;
- tam release doğrulaması, yedek, dry-run, migration, deployment ve canlı
  production kontrolü;
- README, changelog ve Faz 4 kapanış raporu.

Kabul kriterleri:

- [ ] Production dependency audit yüksek/kritik açık göstermez.
- [ ] Lint, typecheck, unit, security, build, temiz DB reset, schema lint,
      pgTAP, restore drill ve tam Playwright paketi başarılıdır.
- [ ] Production öncesi DB ve Storage yedeği doğrulanır.
- [ ] Migration dry-run yalnız beklenen Faz 4 migration'larını gösterir.
- [ ] Canlı health, giriş, rol izolasyonu ve kritik okuma akışları doğrulanır.
- [ ] Tüm Faz 4 issue'ları kanıt bağlantılarıyla kapatılır.

## 4. Bağımlılık sırası

Önerilen uygulama sırası:

`4.1 → 4.1.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 → 4.8 → 4.9`

- 4.6 ve 4.7, zamanlanmış işler için 4.2 altyapısını yeniden kullanır.
- 4.5 sağlayıcı kararı olmadan başlamaz.
- 4.9 diğer bütün uygulama aşamalarının kapanışıdır.

## 5. GitHub takip modeli

- Milestone: `Faz 4 — Operasyon Otomasyonu ve CRM İyileştirmeleri`
- Her 4.x alt aşaması ayrı issue olarak takip edilir.
- Issue başlığı sıra numarasıyla başlar.
- Bir issue yalnız kod, test, doküman ve gerekli production kanıtları
  tamamlandığında kapatılır.
- Bekleyen ürün veya sağlayıcı kararı issue içinde açık blokaj olarak tutulur.

GitHub kayıtları:

- [Milestone #1](https://github.com/abidinyldz06/nobel-vize-crm/milestone/1)
- [Faz 4.1 — Issue #31](https://github.com/abidinyldz06/nobel-vize-crm/issues/31)
- [Faz 4.1.1 — Issue #43](https://github.com/abidinyldz06/nobel-vize-crm/issues/43)
- [Faz 4.2 — Issue #32](https://github.com/abidinyldz06/nobel-vize-crm/issues/32)
- [Faz 4.3 — Issue #33](https://github.com/abidinyldz06/nobel-vize-crm/issues/33)
- [Faz 4.4 — Issue #34](https://github.com/abidinyldz06/nobel-vize-crm/issues/34)
- [Faz 4.5 — Issue #35](https://github.com/abidinyldz06/nobel-vize-crm/issues/35)
- [Faz 4.6 — Issue #36](https://github.com/abidinyldz06/nobel-vize-crm/issues/36)
- [Faz 4.7 — Issue #37](https://github.com/abidinyldz06/nobel-vize-crm/issues/37)
- [Faz 4.8 — Issue #38](https://github.com/abidinyldz06/nobel-vize-crm/issues/38)
- [Faz 4.9 — Issue #39](https://github.com/abidinyldz06/nobel-vize-crm/issues/39)
