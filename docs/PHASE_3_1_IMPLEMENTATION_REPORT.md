# Faz 3.1 — Staging ve Production Hazırlığı Uygulama Raporu

Tarih: 20–21 Temmuz 2026
Dal: `phase-3/internal-crm-production`
Durum: **Tamamlandı**

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
| Canlı veri kopyasında migration provası | Geçti, kayıt sayıları korundu |
| Migration sonrası veri kalite kontrolü | Geçti; production'da 18/18 sayaç sıfır |
| Anonim public politika kontrolü | Geçti, 0 politika |
| Documents bucket gizlilik kontrolü | Geçti, private |
| Playwright | Geçti, 5/5 |
| Playwright — Node 20.20.2 | Geçti, 5/5 |
| Profil aç/kapat | Geçti |
| Sistem Ayarları geçişi | Geçti |
| Profil menüsünden çıkış | Geçti |
| GitHub Actions — application | Geçti |
| GitHub Actions — database | Geçti |
| GitHub Actions — browser | Geçti |
| Vercel Preview | Geçti |
| Production migration zinciri | Geçti, 7/7 migration yerel/uzak eşleşiyor |
| Production constraint doğrulaması | Geçti, 28/28 constraint validated |
| Production portal smoke | Geçti; geçerli ve geçersiz bağlantılar HTTP 200 |
| `abidinyildiz.com` production yayını | Geçti |

GitHub Actions'ın ilk browser turunda Node 20 WebSocket farkı yakalandı. `ws`
transport düzeltmesi yerelde Node 20 ile doğrulandıktan sonra ikinci turdaki
application, database ve browser işlerinin tamamı başarılı oldu.

## CRM production envanteri

Supabase CLI ile doğru production projesi olarak `CRM`
(`zrxdwnshegihakqfszfh`) belirlendi ve salt-okunur kontroller tamamlandı.
Production migration zinciri kontrollü bakım penceresinde uygulandı ve
production kontrolleri tamamlandı.

| Kontrol | Bulgular |
|---|---|
| PostgreSQL | 17.6.1.127 |
| Migration geçmişi | Yerel ve uzak 7 migration eşleşiyor |
| Şema lint | Hata yok |
| Tahmini temel kayıtlar | 9 müşteri, 7 başvuru, 62 belge, 3 personel |
| Anonim genel okuma politikaları | Kaldırıldı; production sonucu 0 politika |
| Veri ilişkileri | Eksik müşteri/personel/başvuru ilişkisi yok |
| Veri uyumsuzluğu | 1 `Öğrenci` vize tipi, 35 `tamamlandi` belge durumu |
| Tekrarlı kural/personel | Yok |
| Storage | `documents` bucket'ında 1 nesne, 250061 bayt |
| Mantıksal yedek | Şifreli, repo dışında ve bağımsız geri açma kontrolü geçti |
| Supabase projeleri | Yalnız güncel `CRM` projesi kaldı; eski kullanılmayan proje silindi |

Canlı veriye uygun migration öncesi kontrol için
`phase1_pre_migration_data_preflight.sql` eklendi. Bulunan iki eski değer,
uygulamadaki kanonik karşılıkları olan `ogrenci` ve `onaylandi` değerlerine
migration içinde dönüştürülüyor.

Production şeması, public verisi ve Storage nesnesi erişimi kısıtlı geçici
alana alındı. Bu kopya üzerinde altı migration sırasıyla başarıyla uygulandı:

- Müşteri, başvuru ve belge kayıt sayıları değişmedi.
- 1 vize tipi ve 35 belge durumu kanonik değerlere dönüştü.
- Public şemadaki anonim politikalar sıfıra indi.
- `documents` bucket'ı private kaldı.
- Migration sonrası bütün veri kalite sayaçları sıfırlandı. Yalnız izole
  klonda Auth şeması taşınmadığı için `staff_without_auth_user=3` görüldü;
  production ön kontrolünde aynı sayaç sıfırdır.

Roller, Auth, şema, public veri ve Storage nesnesini içeren production öncesi
yedek AES-256-CBC/PBKDF2 ile şifrelendi, repo dışında `600` izniyle saklandı ve
bağımsız olarak geri açılıp arşiv bütünlüğü doğrulandı. Parola macOS
Keychain'dedir. Supabase ücretli PITR/branch kullanılmadığı için kullanıcı
kararıyla ayrı staging yerine bu şifreli yedek ve canlı veri kopyası provası
kalite kapısı olarak kullanıldı.

## Production geçiş sonucu

- `202607190001`–`202607200006` migration zinciri doğru `CRM` projesine
  uygulandı; yerel ve uzak migration geçmişleri eşleşti.
- Migration sonrası 18 veri kalite sayacının tamamı sıfırlandı; 9 müşteri,
  7 başvuru, 62 belge ve 3 personel kaydı korundu.
- Geçişte `NOT VALID` eklenen 28 check/foreign-key constraint yeni
  `202607200006_phase1_validate_constraints.sql` migration'ıyla doğrulandı.
- Public anonim politikalar sıfıra indi ve `documents` bucket private kaldı.
- Vercel Production/Preview ortamlarına eksik sunucu tarafı
  `SUPABASE_SERVICE_ROLE_KEY` güvenli değişkeni eklendi; değer rapora veya git
  geçmişine yazılmadı.
- En son başarılı Production sürümü yeni ortam ayarlarıyla yeniden dağıtıldı ve
  `abidinyildiz.com` alan adına bağlandı.
- Ana sayfa, geçersiz portal bağlantısı ve gerçek müşteri portalı HTTP 200
  verdi; gerçek portal beklenen `Müşteri Portalı` içeriğiyle doğrulandı.

Bu kanıtlarla **Faz 3.1 tamamlandı**. Sonraki çalışma paketi Faz 3.2'dir.
