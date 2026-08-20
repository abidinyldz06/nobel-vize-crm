# Nobel Vize CRM — 20 Ağustos 2026 Sonrası Yol Haritası

- Başlangıç tarihi: 20 Ağustos 2026
- Ön koşul: Faz 5.0–5.7 production kabulü tamamlandı
- Ürün modeli: Tek şirketli Nobel Vize iç CRM

## 1. Öncelik mantığı

Sıra; production güvenliği, dış sağlayıcı zorunlulukları, günlük operasyon iş
değeri ve ölçülebilir kullanıcı ihtiyacına göre belirlenmiştir. Bir sonraki
başlık, önceki başlığın kabul kapısı tamamlanmadan “bitti” sayılmaz.

## 2. P0 — Google yönetişimini tamamla

### 2.1 Kod ve public sayfaların yayını — Tamamlandı, 20 Ağustos 2026

PR #68, `a1beacc` merge commit'iyle ana dala alındı. Main Quality Gates
#32339716334, Vercel production deployment `ABJUDCeW2a83SXiYPeJwT31AhBuB`
ve public HTTP kontrolleri başarılıdır. Ayrıntılı kanıt
`PHASE_5_7_PRODUCTION_CLOSURE.md` dosyasındadır.

- [x] Public `/`, `/privacy-policy` ve `/terms` sayfalarını production'a çıkar.
- [x] Personel girişini `/login` adresine taşı; mevcut MFA ve rol korumasını koru.
- [x] Google Takvim kapsamını `calendar.events.owned` olarak yayınla.
- [x] Eşitlemenin yalnız CRM bağlantılı etkinlikleri okuduğunu doğrula.
- [x] Bağlantı kaldırmada Google revoke isteğini ve yerel şifreli token/eşleme
  temizliğini doğrula.

Kabul ölçütleri:

- [x] PR kalite kapıları, ana dal kalite kapıları ve production deployment yeşil.
- [x] `/`, `/login`, `/privacy-policy`, `/terms`, `/api/health/live` ve
  `/api/health/ready` HTTP 200.
- [x] Giriş, Google ile giriş ve mevcut admin MFA akışında regresyon yok.
- [x] Çalışan canlı Google Takvim bağlantısı yayın sırasında koparılmıyor.

### 2.2 Google Cloud Branding ve Data Access

- App home page, Privacy Policy ve Terms bağlantılarını production URL'leriyle
  güncelle.
- Kullanıcı destek ve geliştirici iletişimini `bilgi@nobelvize.com` olarak
  doğrula.
- `abidinyildiz.com` alan adını yetkili alan adı olarak doğrula.
- Data Access bölümünde eski `calendar.events` iznini kaldırıp
  `calendar.events.owned` iznini kaydet.
- Uygulama adı, logo ve alan adı tutarlılığını kontrol et.

Kabul ölçütleri:

- Google Cloud konsolunda Branding yayınlanmış ve üç public bağlantı açılıyor.
- OAuth izin ekranı yalnız gerekli giriş kapsamları ile
  `calendar.events.owned` gösteriyor.
- Production callback adresleri değiştirilmeden çalışıyor.

### 2.3 Hassas kapsam doğrulaması

- Canlı yöneticinin çalışan bağlantısından ayrı bir doğrulama/test kullanıcısı
  hazırla.
- İngilizce anlatımlı, kesintisiz ve Unlisted YouTube demo videosunu oluştur.
- Bağlama, CRM'den Google'a yazma, Google'dan CRM'e alma ve test hesabında
  bağlantıyı/yetkiyi kaldırma adımlarını göster.
- Google'a kapsam gerekçesi, public bağlantılar ve video ile başvur.
- İnceleme sorularını aynı kanıt seti üzerinden yanıtla.

Kabul ölçütleri:

- Başvuru kimliği/tarihi rapora eklenmiş.
- Google'ın istediği değişiklikler ayrı PR ve tarihli ek raporla izlenmiş.
- Onay veya istisna sonucu kaydedilmiş; kullanıcı sınırı ve yayın durumu
  yoruma bırakılmamış.

## 3. P1 — Veri kalitesini gerçek operasyon verisiyle olgunlaştır

### 3.1 Veri kalite kuyruğu işletim kabulü

- Gerçek müşteri ve başvuru kayıtlarında eksik alan dağılımını ölç.
- Veri kontrol görevleri için sorumlu, son tarih ve kapanış SLA'sı belirle.
- Tekrarlanan, çelişkili ve sahipsiz kayıtları yönetici panelinde ayır.
- Tamamlanma oranını haftalık izlenebilir metrik haline getir.

Kabul ölçütleri:

- Eksik alanlar kategori ve sorumlu bazında sayılabiliyor.
- Tamamlanan veri görevi gerçek alan dolunca otomatik kapanıyor.
- Otomatik veri uydurma veya sessiz overwrite yok.
- En az bir gerçek operasyon haftası ölçüm raporuna alınmış.

### 3.2 Ülke ve vize evrak kurallarını genişlet

- Fransa turistik/öğrenci kayıtlarını France-Visas profil çıktılarıyla kesinleştir.
- İtalya ticari listeyi güncel resmî kaynakla yeniden doğrula.
- Sonraki ülke/vize paketlerini gerçek başvuru hacmine göre sırala.
- Her kuralda kaynak, kontrol tarihi, geçerlilik tarihi ve yeniden kontrol
  tarihi tut.
- Süresi dolan veya çelişen kuralı yönetici uyarısına dönüştür.

Kabul ölçütleri:

- Resmî kaynak olmadan kayıt `doğrulandı` durumuna alınmıyor.
- Süresi geçen kural açıkça görünür ve operasyon görevi üretiyor.
- Genel liste ile profil ekleri çakışmadan birleşiyor.
- Her ülke paketi için kaynak ve production kabul raporu bulunuyor.

### 3.3 Yedek ve geri yükleme disiplini

- Production yedek tazeliğini düzenli izle.
- Private Storage belge binary sürekliliğini ayrıca doğrula.
- İzole geri yükleme tatbikatını periyodik çalıştır ve sonuçları raporla.
- Başarısız/eskimiş recovery point için yönetici uyarısı üret.

Kabul ölçütleri:

- Son başarılı yedek ve doğrulama tarihi görünür.
- Restore tatbikatı production verisini değiştirmeden geçiyor.
- Storage envanteri ile belge binary sürekliliği ayrı ayrı kanıtlı.

## 4. P2 — Gerçek kullanım verisiyle operasyonu geliştir

### 4.1 Takvim güvenilirliği ve gözlemlenebilirlik

- Google API hata/rate limit davranışını ölç; güvenli backoff ve retry uygula.
- Eşitleme gecikmesi, başarısızlık ve son başarılı çalışma metriklerini görünür yap.
- Bağlantı kaldırma akışını ayrı test kullanıcısında uçtan uca kabul et.
- Outlook entegrasyonunu yalnız gerçek personel talebi ve kullanım hacmi varsa
  yeniden değerlendir.

### 4.2 Müşteri portalı kullanım kabulü

- Güvenli evrak yükleme, eksik evrak ve başvuru durumu görünürlüğünü gerçek
  kullanıcı senaryosuyla doğrula.
- Süreli bağlantı yenileme/iptal akışını işletim prosedürüne bağla.
- Portal kullanım, başarısız yükleme ve danışman dönüş süresini ölç.

### 4.3 Kapasite, iş yükü ve tahsilat

- Danışman kapasite limitlerini gerçek randevu ve açık başvuru verisiyle ayarla.
- İş yükü dengesizliği ve SLA riski için yönetici uyarısı üret.
- Geciken ödeme yaşlandırması, son tarih ve tahsilat görevlerini gerçek süreçte
  doğrula.
- Finansal raporların yalnız kanonik ödeme verisinden üretildiğini koru.

### 4.4 E-posta operasyonunun olgunlaştırılması

- Resend teslim, bounce ve retry oranlarını düzenli raporla.
- Şablon sürümü, izin/ret kontrolü ve gönderim audit izini gözden geçir.
- Alan adı kimlik doğrulama ve teslim edilebilirlik ayarlarını periyodik doğrula.
- Sandbox ve hata senaryolarını production verisini kirletmeden tekrarla.

## 5. P3 — Bakım ve yönetişim

- Dependabot patch/minor güncellemelerini beklenen head SHA ve yeşil kontrollerle
  sırayla birleştir.
- Ana sürüm bağımlılık değişikliklerini ayrı uyumluluk paketi olarak ele al.
- Aylık production dependency audit ve düzenli RLS/migration drift kontrolünü
  sürdür.
- Çeyreklik rol izolasyonu, MFA, portal, KVKK, yedek/restore ve kritik akış
  kabul paketi çalıştır.
- Yol haritası ve ana rapor dizinini her production kapanışında güncelle.

## 6. Açıkça ertelenen veya kapsam dışı işler

| İş | Karar | Yeniden açma koşulu |
|---|---|---|
| WhatsApp Business API | Ertelendi | Onaylı işletme hesabı, maliyet, izin/ret ve canlı kabul kapsamı ayrıca kararlaştırılırsa |
| Outlook iki yönlü takvim | Ertelendi | Google dışı gerçek personel ihtiyacı ve kullanım hacmi kanıtlanırsa |
| Çok kiracılı SaaS/abonelik | Kapsam dışı | İkinci bağımsız şirket ve self-service ücretli onboarding ihtiyacı doğarsa |
| White-label/subdomain | Kapsam dışı | SaaS ürün kararı yeniden açılırsa |

## 7. Önerilen GitHub takip yapısı

Yeni işler raporda kaybolmamalı; uygulamaya başlanacağı zaman aşağıdaki dört
milestone altında issue'lara ayrılmalıdır:

1. **Faz 5.7 — Google Doğrulama ve Public Yüzey**
2. **Faz 5.8 — Veri Kalitesi ve Ülke Kuralı Genişletme**
3. **Faz 5.9 — Operasyon Ölçümü ve Güvenilirlik**
4. **Sürekli Bakım — Güvenlik, Bağımlılık ve Recovery**

Bu rapor milestone veya issue'ları kendiliğinden açmaz. Uygulama kapsamı
başlatıldığında her issue; amaç, kapsam dışı alan, kabul ölçütü, veri etkisi,
geri dönüş ve production kanıtı başlıklarını içermelidir.
