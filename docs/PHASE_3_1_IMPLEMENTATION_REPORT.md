# Faz 3.1 — Staging ve Production Hazırlığı Uygulama Raporu

Tarih: 20 Temmuz 2026
Dal: `phase-3/internal-crm-production`
Durum: **Devam ediyor**

## Tamamlanan yerel çalışmalar

- Faz 3 dalı, Faz 2'nin merge edildiği güncel `main` üzerinden açıldı.
- Sağ üst profil avatarının yalnızca görsel bir `div` olması nedeniyle hiç
  açılamayan profil alanı gerçek ve erişilebilir bir menüye dönüştürüldü.
- Personel bilgileri tarayıcıda ikinci kez sorgulanmak yerine sunucuda
  `requireStaffPage` ile doğrulanan oturum bağlamından aktarılıyor.
- Profil menüsü ad, e-posta, rol ve kısa personel numarasını gösteriyor.
- Menü dışarı tıklama ve Escape ile kapanıyor; admin için Sistem Ayarları ve
  bütün personel için güvenli Çıkış Yap işlemi sunuyor.
- Sidebar aynı doğrulanmış profil bağlamını kullanıyor; eksik personel kaydında
  kullanıcıyı admin varsayan istemci fallback'i kaldırıldı.
- Yerel Supabase üzerinde gerçek test yöneticisi oluşturan oturumlu Playwright
  regresyon testi eklendi. Test kullanıcısı senaryo sonunda temizleniyor.
- Supabase test istemcisine `ws` transport'u verilerek oturumlu test Node 20
  kullanan GitHub Actions ortamıyla uyumlu hale getirildi.

## Doğrulama durumu

| Kontrol | Sonuç |
|---|---|
| ESLint | Geçti, 0 bulgu |
| TypeScript | Geçti |
| Node testleri | Geçti, 16/16 |
| Dependency audit | High eşiği geçti; bilinen 2 moderate PostCSS bulgusu sürüyor |
| Production build | Geçti |
| Yerel migration reset | Geçti |
| Üretilmiş Supabase tip drift kontrolü | Geçti |
| Veritabanı lint | Geçti, şema hatası yok |
| pgTAP | Geçti, 25/25 |
| Playwright | Geçti, 5/5 |
| Playwright — Node 20.20.2 | Geçti, 5/5 |
| Profil aç/kapat | Geçti |
| Sistem Ayarları geçişi | Geçti |
| Profil menüsünden çıkış | Geçti |
| GitHub Actions — application | Geçti |
| GitHub Actions — database | Geçti |
| GitHub Actions — browser | Geçti |
| Vercel Preview | Geçti |

GitHub Actions'ın ilk browser turunda Node 20 WebSocket farkı yakalandı. `ws`
transport düzeltmesi yerelde Node 20 ile doğrulandıktan sonra ikinci turdaki
application, database ve browser işlerinin tamamı başarılı oldu.

## Dış ortam durumu

Bu çalışma alanında Supabase CLI oturumu, bağlı uzak proje ve `.env.local`
bulunmamaktadır. GitHub repository ortamları `Preview` ve `Production` olarak
tanımlı olsa da Actions secret/variable kaydı yoktur. Bu nedenle uzak ortamda
salt-okunur envanter veya migration uygulanmamıştır.

Faz 3.1'in tamamlandı sayılması için:

1. Ayrı staging Supabase projesi belirlenmeli veya oluşturulmalıdır.
2. Supabase CLI bu projeye güvenli biçimde bağlanmalıdır.
3. Staging yedeği, envanteri ve veri kalite ön kontrolü alınmalıdır.
4. Faz 0–1 migration zinciri staging'e uygulanmalıdır.
5. Rol, portal, private Storage, webhook ve restore regresyonları geçmelidir.
6. Production uygulaması ayrı bakım penceresinde raporlanmalıdır.

Bu kanıtlar alınmadan README ve yol haritasında Faz 3.1 `Tamamlandı` olarak
işaretlenmeyecektir.
