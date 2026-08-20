# Faz 5.7 — Production Kapanış Kaydı

- Tarih: 20 Ağustos 2026
- Production: `https://abidinyildiz.com`
- Sonuç: Tamamlandı

## 1. GitHub yayın kanıtı

- Pull request: [#68](https://github.com/abidinyldz06/nobel-vize-crm/pull/68)
- Doğrulanan PR head SHA:
  `52397ef8a4992759c78dd5ad5091715bdcc2506a`
- Squash merge commit:
  `a1beacc6bdfa7a3f5f782f2ae12ca0e462928c75`
- Birleştirme zamanı: `2026-08-20T06:28:02Z`
- Birleştirme yöntemi: Beklenen head SHA kilitli squash merge
- Açık review, review comment veya çözülmemiş inceleme başlığı: Yok

PR Quality Gates run
[#32338994374](https://github.com/abidinyldz06/nobel-vize-crm/actions/runs/32338994374)
başarıyla tamamlandı:

- application: lint, typecheck, 82 test, production dependency audit ve build;
- database: temiz reset, üretilmiş tip kontrolü, schema lint, 433 PostgreSQL
  testi ve restore tatbikatı;
- browser: 31 Chromium senaryosu;
- Vercel preview: başarılı.

Ana dal Quality Gates run
[#32339716334](https://github.com/abidinyldz06/nobel-vize-crm/actions/runs/32339716334)
aynı `a1beacc` commit'i için application, database ve 31 browser senaryosuyla
başarılıdır.

## 2. Production deployment

- Sağlayıcı: Vercel
- Deployment: `ABJUDCeW2a83SXiYPeJwT31AhBuB`
- Commit status: `success`
- Alan adı: `abidinyildiz.com`

20 Ağustos 2026 saat `06:37Z` sonrasında doğrulanan HTTP sonuçları:

| Adres | Sonuç |
|---|---|
| `/` | HTTP 200; public ürün başlığı ve Personel Girişi bağlantısı görünür |
| `/login` | HTTP 200; Nobel Vize CRM personel giriş formu görünür |
| `/privacy-policy` | HTTP 200; Google kullanıcı verisi ve Limited Use açıklaması görünür |
| `/terms` | HTTP 200; Kullanım Şartları ve hizmet kapsamı görünür |
| `/api/health/live` | HTTP 200, `ok` |
| `/api/health/ready` | HTTP 200, `ready` |
| `/dashboard` anonim isteği | HTTP 307 ile `/login` adresine yönlenir |

Repository production doğrulama betiği de live, ready ve ana sayfa için
başarılı sonuç verdi.

## 3. Güvenlik ve veri etkisi

- Bu pakette yeni veritabanı migration'ı yoktur; mevcut 45 migration zinciri
  değişmemiştir.
- Google ile giriş kapsamları ile Google Takvim izin akışı ayrı kalmıştır.
- Takvim izni daha dar `calendar.events.owned` kapsamına indirilmiştir.
- Takvim okuma işlemi yalnız CRM tarafından kimliği saklanan bağlı etkinlikleri
  getirir; kullanıcının ilgisiz takvim etkinliklerini listelemez.
- Bağlantı kaldırma Google revoke endpoint'ini çağırır ve uzak iptal geçici
  başarısız olsa bile yerel şifreli tokenlarla etkinlik eşlemelerini siler.
- Çalışan production Google Takvim bağlantısı yayın sırasında koparılmamıştır.
- Canlı yöneticinin bağlantısı üzerinde yıkıcı disconnect kabulü yapılmamıştır;
  bu senaryo ayrı test kullanıcısına bırakılmıştır.

## 4. Bu kapanıştan sonra açık kalan dış işler

Faz 5.7 kod ve production yayını tamamlanmıştır. Aşağıdaki maddeler Google
yönetişim sürecidir ve production uygulama yayınıyla aynı şey değildir:

1. Google Cloud Branding alanlarına canlı home/privacy/terms adreslerini yazmak.
2. Data Access bölümünde `calendar.events.owned` kapsamını yayınlamak.
3. `abidinyildiz.com` alan adı doğrulamasını tamamlamak.
4. Ayrı test kullanıcısıyla İngilizce Unlisted demo videosu hazırlamak.
5. Hassas kapsam doğrulama başvurusunu göndermek ve inceleme sonucunu kaydetmek.

WhatsApp Business bu kapanışın parçası değildir; 20 Ağustos 2026 ürün kararıyla
ertelenmiştir.
