# Nobel Vize CRM — Teknik İnceleme ve Yol Haritası

Son inceleme: 26 Temmuz 2026

İncelenen production sürümü: `3a4d66c`

## Amaç

Bu belge Nobel Vize CRM'in yaşayan teknik durum kaydıdır. Ayrıntılı uygulama
kapsamı ilgili faz planlarında, tamamlanma kanıtı ise uygulama ve production
kapanış raporlarında tutulur. Değişiklikler kalite, güvenlik, yedek ve yayın
kapılarından geçmeden production'a gönderilmez.

## Güncel ürün ve mimari kararı

Uygulama Nobel Vize için tek şirketli iç CRM'dir. Müşteri, başvuru, evrak,
randevu, ödeme, görev, bildirim, personel, iletişim, müşteri portalı, KVKK,
raporlama, yedek ve operasyonel izleme akışlarını kapsar.

SaaS/tenant, abonelik, plan, kota, faturalandırma, white-label ve subdomain
özellikleri ertelenmiştir. İkinci bağımsız şirket, self-service ücretli
onboarding veya tenant bazlı sözleşme ihtiyacı doğmadan bu karar yeniden
açılmaz.

## Tamamlanan teknik temel

### Faz 0 — Güvenlik ve veri koruma

- fail-closed personel/admin yetkilendirmesi;
- API ve sayfa rol kontrolleri;
- imzalı ve tekrar saldırısı korumalı Google Form webhook'u;
- sunucu tarafı müşteri portalı;
- private evrak Storage bucket'ı;
- recursion oluşturmayan rol bazlı RLS;
- güvenli personel davet akışı;
- korumalı restore ve temel güvenlik başlıkları.

Production uygulama ayrıntıları `docs/PHASE_0_DEPLOYMENT_RUNBOOK.md`
dosyasındadır.

### Faz 1 — Veritabanı standardizasyonu

- sürümlü Supabase migration zinciri;
- kanonik ülke/vize kuralı modeli;
- foreign key, check ve indeks standardizasyonu;
- kritik müşteri/başvuru işlemlerinde atomik RPC;
- sürümlü ve atomik backup/restore;
- pgTAP tabanlı şema ve iş akışı kontrolleri.

Kanıtlar `docs/PHASE_1_IMPLEMENTATION_REPORT.md` dosyasındadır.

### Faz 2 — Stabilizasyon ve kalite

- dashboard ve rapor hesap düzeltmeleri;
- Supabase üretimli TypeScript tipleri;
- lint borcunun kapatılması;
- birim, güvenlik ve Playwright testleri;
- GitHub Actions application/database/browser kalite kapıları;
- production dependency audit;
- güvensiz XLSX bağımlılığının kaldırılması.

Kanıtlar `docs/PHASE_2_IMPLEMENTATION_REPORT.md` dosyasındadır.

### Faz 3 — İç CRM ürünleştirme ve production kapanışı

- görev, kişisel bildirim ve operasyon hatırlatmaları;
- başvuru süreç panosu ve kanonik profil alanları;
- müşteri etiketleri, hızlı eylemler ve birleşik timeline;
- yönetilebilir iletişim ve kontrollü müşteri portalı;
- KVKK kayıtları ve kontrollü veri yaşam döngüsü;
- request ID, güvenli yapılandırılmış log, health/readiness ve operasyon uyarıları;
- doğrulanmış yedek geçmişi ve izole restore tatbikatı;
- rol izolasyonu, kritik/kenar akış, responsive, erişilebilirlik, performans,
  migration, RLS ve production kabul kapıları.

Faz 3.1–3.8 tamamlanma durumu `docs/PHASE_3_PLAN.md`; son production kapanışı
`docs/PHASE_3_8_RELEASE_AND_CLOSURE.md` dosyasındadır.

## Güncel öncelikler

### Kapatıldı — Yanıltıcı müşteri puanlaması

Faz 4.1 ile `profile_score`; arayüz, uygulama mantığı, veritabanı, rapor ve
dışa aktarma akışlarından kaldırıldı. Gerçek başvuru sonuçları ile evrak
metrikleri korunurken sabit başarı yüzdeleri kaldırıldı. Eski yedek girdileri
yeni şemada güvenle yok sayılır.

### P1 — Zamanlanmış operasyon ve iş sürekliliği

- Operasyon görev senkronizasyonu bugün görev API'sinin çağrılmasına bağlıdır;
  kullanıcı etkileşiminden bağımsız cron çalışması gerekir.
- Uygulama yedeği Storage envanterini içerir, private belge binary'lerini
  içermez; tam otomatik ve repo dışı yedekleme gerekir.
- Otomatik KVKK uygulaması varsayılan olarak kapalıdır; dry-run ve yönetici
  onaylı güvenli zamanlayıcı gerekir.

### P1 — Hesap ve iletişim güvenilirliği

- Admin/personel hesapları için MFA, giriş sınırlaması ve oturum yönetimi
  planlanmıştır.
- WhatsApp/e-posta akışı harici uygulama açıp teslim durumunu manuel izler;
  sağlayıcı kararı sonrası kuyruk, webhook ve retry destekli gerçek gönderim
  gerekir.

### P2 — CRM operasyon verimliliği

- lead yaşam döngüsü, kaynak/kampanya, mükerrer kayıt ve SLA takibi;
- takvim dışa aktarma/entegrasyon ve randevu çakışma yönetimi;
- sabit tahmin kullanmayan gelişmiş sonuç, tahsilat, SLA ve iş yükü raporları.

### P3 — Sürdürülebilir bakım

- uyumlu patch/minor bağımlılık güncellemeleri;
- Dependabot ve zamanlanmış production dependency audit;
- mevcut Next lint eklentisi uyumlu olmadan ESLint 10'a geçilmemesi;
- TypeScript ve Node tiplerinde ana sürüm geçişlerinin ayrı uyumluluk
  çalışmasına bağlanması.

## Faz 4

Faz 4'ün sıralı kapsamı:

1. 4.0 — Plan, kabul kriterleri ve GitHub iş listesi — tamamlandı
2. 4.1 — Yanıltıcı müşteri puanlamasının kaldırılması — release adayı tamamlandı
3. 4.2 — Zamanlanmış operasyon sistemi
4. 4.3 — Otomatik, şifreli ve repo dışı DB/Storage yedeği
5. 4.4 — Hesap ve giriş güvenliğinin güçlendirilmesi
6. 4.5 — Sağlayıcı destekli gerçek bildirim ve iletişim
7. 4.6 — Kontrollü KVKK yaşam döngüsü otomasyonu
8. 4.7 — Lead ve müşteri operasyonlarının geliştirilmesi
9. 4.8 — Takvim entegrasyonu ve gelişmiş gerçek raporlar
10. 4.9 — Bakım, kabul ve production kapanışı

Ayrıntılı kapsam, kapsam dışı maddeler, bağımlılıklar ve kabul kriterleri
`docs/PHASE_4_PLAN.md` dosyasındadır.

## Yayın kontrol listesi

Her değişiklik paketi için aşağıdakiler tamamlanmadan push/PR yapılmaz:

1. Değişiklik kapsamı ve diff gözden geçirilir.
2. İlgili lint, typecheck, birim ve güvenlik testleri başarılıdır.
3. Production bağımlılık ağında yüksek/kritik açık bulunmaz.
4. Veritabanı değişikliğinde temiz reset, üretilen tip diff'i, schema lint,
   pgTAP, yedek, dry-run, staging ve geri dönüş adımları tamamlanır.
5. Kritik kullanıcı akışları Playwright ile doğrulanır.
6. Production build başarılıdır.
7. Commit, changelog, README ve issue kayıtları gerçek kapsamı yansıtır.
8. Canlı doğrulama veri değiştirmeyen kontrollerle yapılır; mutating akışlar
   izole release adayında test edilir.
