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
| Canlı veri kopyasında migration provası | Geçti, kayıt sayıları korundu |
| Migration sonrası veri kalite kontrolü | Geçti; Auth hariç 17/18 sayaç sıfır |
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

GitHub Actions'ın ilk browser turunda Node 20 WebSocket farkı yakalandı. `ws`
transport düzeltmesi yerelde Node 20 ile doğrulandıktan sonra ikinci turdaki
application, database ve browser işlerinin tamamı başarılı oldu.

## CRM production envanteri

Supabase CLI ile doğru production projesi olarak `CRM`
(`zrxdwnshegihakqfszfh`) belirlendi ve salt-okunur kontroller tamamlandı.
Production üzerinde migration uygulanmadı.

| Kontrol | Bulgular |
|---|---|
| PostgreSQL | 17.6.1.127 |
| Migration geçmişi | Uzakta boş; yerelde 6 bekleyen migration |
| Şema lint | Hata yok |
| Tahmini temel kayıtlar | 9 müşteri, 7 başvuru, 62 belge, 3 personel |
| Eski güvenlik durumu | Müşteri, başvuru, belge ve ödeme için anonim genel okuma politikaları mevcut |
| Veri ilişkileri | Eksik müşteri/personel/başvuru ilişkisi yok |
| Veri uyumsuzluğu | 1 `Öğrenci` vize tipi, 35 `tamamlandi` belge durumu |
| Tekrarlı kural/personel | Yok |
| Storage | `documents` bucket'ında 1 nesne, 250061 bayt |
| Platform yedeği | PITR kapalı, listelenen fiziksel yedek yok |
| Supabase branch | Staging/preview branch yok |

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

Roller, şema, public veri ve Storage nesnesini içeren production öncesi yedek
AES-256-CBC/PBKDF2 ile şifrelendi, repo dışında `600` izniyle saklandı ve
geri açılarak doğrulandı. Parola macOS Keychain'dedir. Bu mantıksal yedek,
Supabase platform yedeği veya ayrı staging ortamının yerini tutmaz.

Faz 3.1'in tamamlandı sayılması için:

1. Ayrı staging Supabase projesi veya güvenli preview branch oluşturulmalıdır.
2. Faz 0–1 migration zinciri staging'e uygulanmalıdır.
3. Rol, portal, private Storage, webhook ve restore regresyonları geçmelidir.
4. Production için platform yedeği/PITR güvenceye alınmalıdır.
5. Production uygulaması ayrı bakım penceresinde raporlanmalıdır.

Bu kanıtlar alınmadan README ve yol haritasında Faz 3.1 `Tamamlandı` olarak
işaretlenmeyecektir.
