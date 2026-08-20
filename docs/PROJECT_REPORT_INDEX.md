# Nobel Vize CRM — Proje Raporları Ana Dizini

- Rapor kesim tarihi: 20 Ağustos 2026
- Production: `https://abidinyildiz.com`
- GitHub: `abidinyldz06/nobel-vize-crm`
- Ürün modeli: Nobel Vize için tek şirketli iç CRM

## 1. Bugünkü kısa durum

20 Ağustos 2026 tarihli inceleme başlangıcında GitHub `main` dalı PR #67'yi
içeren `6839d10` commit'indedir. Ana dalın son Quality Gates koşusu başarılı,
production liveness ve readiness uçları HTTP 200, açık issue ve açık PR sayısı
sıfırdır. Faz 4 milestone'u 10/10 kapalı issue ile kapanmıştır.

Faz 5.0–5.6 production kabulünden geçmiştir. Resend gerçek e-posta teslimi,
Google ile personel girişi ve Google Takvim gidiş-dönüş eşitlemesi canlıda
doğrulanmıştır. Faz 5.7; public ürün/gizlilik/şartlar sayfaları, daha dar Google
Takvim kapsamı ve kontrollü yetki iptaliyle bu rapor paketinin yayın adayıdır.
Bu aday production'a çıkmadan public `/login`, `/privacy-policy` ve `/terms`
adreslerinin 404 dönmesi beklenen ve doğrulanmış mevcut durumdur.

## 2. Hangi rapor ne için kullanılır?

| Belge | Amaç | Güncellik kuralı |
|---|---|---|
| `PROJECT_HISTORY_AND_CURRENT_STATUS_2026_08_20.md` | Başlangıçtan bugüne yapılanlar, GitHub PR/issue dökümü ve mevcut kanıtlar | 20 Ağustos 2026 denetim anlık görüntüsü |
| `PROJECT_ROADMAP_FROM_2026_08_20.md` | Bundan sonraki işlerin öncelik, bağımlılık ve kabul ölçütleri | Yeni ürün kararı veya kapanışta güncellenir |
| `PHASE_5_PLAN.md` | Faz 5 alt aşamalarının ürün ve uygulama kaydı | Faz bazlı yaşayan plan |
| `PHASE_5_7_GOOGLE_VERIFICATION_READINESS.md` | Google Branding, Data Access ve hassas kapsam başvuru hazırlığı | Faz 5.7 yayın ve Google inceleme sonucunda güncellenir |
| `PHASE_5_6_LIVE_ACCEPTANCE.md` | Resend ve Google Takvim gerçek production kabul kanıtı | Tarihsel kapanış kaydı; değiştirilmez |
| `PHASE_5_0_CLOSURE_REPORT.md` | Temizlik, kontrollü Dependabot birleştirmeleri ve Faz 4 kapanışı | Tarihsel kapanış kaydı; değiştirilmez |
| `TECHNICAL_AUDIT_AND_ROADMAP.md` | 26 Temmuz 2026 teknik incelemesi | Tarihsel anlık görüntü; güncel plan değildir |

## 3. Durum ifadelerinin anlamı

Bir iş aşağıdaki basamaklar ayrı ayrı doğrulanmadan “production'da tamamlandı”
sayılmaz:

1. **Yerel uygulama:** Kod ve rapor çalışma alanında hazırdır.
2. **Yerel kalite:** Lint, tip, test, build ve gerekiyorsa veritabanı/E2E
   kapıları geçmiştir.
3. **GitHub dalı:** Commit uzak dala gönderilmiştir.
4. **PR:** İncelenebilir pull request açılmış ve gerekli kontroller geçmiştir.
5. **Ana dal:** Beklenen head commit kontrollü biçimde `main` dalına alınmıştır.
6. **Production:** Ana dal CI, deployment, health ve ilgili canlı kabul
   kanıtları tamamlanmıştır.

Bu ayrım özellikle Faz 5.7 gibi yerelde hazır fakat rapor kesim anında henüz
production'da olmayan paketlerin yanlışlıkla canlı kabul edilmiş sayılmasını
önler.

## 4. Faz özeti

| Faz | Sonuç | Production durumu | Ana kanıt |
|---|---|---|---|
| Faz 0 | Yetkilendirme, RLS, webhook, private Storage ve güvenli restore temeli | Tamamlandı | `PHASE_0_DEPLOYMENT_RUNBOOK.md` |
| Faz 1 | Migration standardı, veri bütünlüğü, atomik iş akışları ve yedek/restore | Tamamlandı | `PHASE_1_IMPLEMENTATION_REPORT.md` |
| Faz 2 | Metrik düzeltmeleri, tip güvenliği ve CI kalite kapıları | Tamamlandı | `PHASE_2_IMPLEMENTATION_REPORT.md` |
| Faz 3 | İç CRM ürünleştirme, portal, KVKK, gözlemleme ve tam kabul | Tamamlandı | `PHASE_3_8_RELEASE_AND_CLOSURE.md` |
| Faz 4 | Otomasyon, yedek, MFA, lead, takvim ve bakım | 2 Ağustos 2026'da kapandı | `PHASE_5_0_CLOSURE_REPORT.md` |
| Faz 5.0 | Repo temizliği ve Faz 4 kanıtlı kapanışı | Tamamlandı | `PHASE_5_0_CLOSURE_REPORT.md` |
| Faz 5.1 | Veri kalite kuyruğu ve doğrulanmış şirket iletişimi | Tamamlandı | `PHASE_5_PLAN.md` |
| Faz 5.2 | Resend e-posta, webhook, izin/ret ve retry altyapısı | Canlı teslim doğrulandı | `PHASE_5_6_LIVE_ACCEPTANCE.md` |
| Faz 5.3 | Google Takvim, portal evrakı, kapasite ve tahsilat | Canlı Takvim kabulü doğrulandı | `PHASE_5_6_LIVE_ACCEPTANCE.md` |
| Faz 5.4–5.5 | Kaynaklı ve katmanlı ülke/vize evrak kataloğu | İlk paket production'da | `PHASE_5_5_COUNTRY_DOCUMENT_CORE.md` |
| Faz 5.6 | Gerçek sağlayıcı ve production kabulü | Tamamlandı | `PHASE_5_6_LIVE_ACCEPTANCE.md` |
| Faz 5.7 | Google doğrulama yüzeyi, veri minimizasyonu ve revoke | Bu rapor paketinde yayın adayı | `PHASE_5_7_GOOGLE_VERIFICATION_READINESS.md` |

## 5. Sabit ürün kararları

- Sistem tek şirketli Nobel Vize iç CRM'idir; çok kiracılı SaaS, abonelik,
  paket, kota, white-label ve self-service onboarding kapsam dışıdır.
- WhatsApp Business 20 Ağustos 2026 kararıyla ertelenmiştir. Ücretli sağlayıcı,
  webhook veya otomatik teslim açılmaz.
- Google Takvim mevcut ihtiyaç için birincil dış takvimdir; Outlook talep ve
  kullanım kanıtı oluşana kadar başlatılmaz.
- Eksik müşteri/başvuru bilgisi tahmin edilmez; görev kuyruğu üzerinden gerçek
  kişi tarafından tamamlanır.
- Ülke/vize evrak kuralında resmî kaynak önceliklidir; kaynak, kontrol ve
  geçerlilik tarihleri olmadan doğrulanmış kural sayılmaz.

## 6. Güncelleme sorumluluğu

Yeni bir paket kapanırken ilgili faz raporunun yanında bu dizindeki faz tablosu
ve gelecek yol haritası da gözden geçirilir. Eski kapanış raporları geriye
dönük olarak yeniden yazılmaz; yeni kanıt tarihli ek raporla kaydedilir.
