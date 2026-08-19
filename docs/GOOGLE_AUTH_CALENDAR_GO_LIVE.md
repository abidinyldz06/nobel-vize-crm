# Google ile Giriş ve Google Takvim Canlıya Alma Kaydı

## Canlı durum — 19 Ağustos 2026

- Google ile giriş production'da aktiftir. Yönetici Google hesabıyla giriş
  yaptı; mevcut MFA politikası sonrasında Dashboard'a ulaştı.
- Google Calendar API etkin, OAuth uygulaması `In production` durumunda ve
  yöneticinin birincil takvimi CRM'e bağlıdır.
- CRM → Google ve Google → CRM yönleri sentetik randevuyla canlı kabulden
  geçti. Google'da yapılan saat ve konum değişikliği CRM'e `rescheduled`
  olarak işlendi; randevu geçmişi ve audit kaydı oluştu.
- İlk kabulte bulunan eşitleme sırası kusuru PR #66 ile düzeltildi ve production
  deployment sonrasında aynı senaryo başarıyla yeniden çalıştırıldı.
- Test etkinliği iptal eşitlemesiyle Google'dan kaldırıldı; sentetik müşteri
  geri yüklenebilir arşive taşındı ve aktif production listesinde test verisi
  bırakılmadı.

## Kapsam ve güvenlik sınırı

- Google ile giriş, Supabase Auth PKCE akışını kullanır.
- Yalnızca Google kimliği mevcut ve aktif bir `staff.user_id` kaydıyla eşleşen personel CRM'e girebilir.
- Yönetici ve danışman MFA politikaları Google ile girişten sonra da aynen uygulanır.
- Google ile giriş yalnızca kimlik, e-posta ve profil kapsamlarını kullanır.
- Google Takvim izni ayrı bir onay akışıdır. Takvim erişim ve yenileme tokenları AES-256-GCM ile şifrelenerek yalnız sunucu erişimli tabloda tutulur.

## Yönlendirme adresleri

Google Cloud'daki Web application OAuth istemcisinde aşağıdaki production adresleri bulunmalıdır:

1. Supabase Google giriş dönüş adresi:
   `https://zrxdwnshegihakqfszfh.supabase.co/auth/v1/callback`
2. CRM Google Takvim dönüş adresi:
   `https://abidinyildiz.com/api/integrations/google-calendar/callback`

Supabase Auth URL Configuration:

- Site URL: `https://abidinyildiz.com`
- İzin verilen uygulama dönüş adresi: `https://abidinyildiz.com/auth/callback`

## Google Cloud kurulumu

1. Google Auth Platform içinde Nobel Vize CRM için bir proje seçilir veya oluşturulur.
2. Audience, yalnız kullanılacak Google hesaplarını kabul edecek biçimde yapılandırılır. Test modunda gerçek yönetici Google hesabı test kullanıcısı olarak eklenir.
3. Data Access bölümünde giriş için `openid`, `userinfo.email` ve `userinfo.profile` kapsamları tanımlanır.
4. Google Calendar API etkinleştirilir ve Takvim bağlantısı için `https://www.googleapis.com/auth/calendar.events` kapsamı eklenir.
5. Web application türünde OAuth istemcisi oluşturulur; iki production dönüş adresi istemciye eklenir.
6. İstemci kimliği ve istemci sırrı Supabase Google provider ayarına girilir.
7. CRM yalnız yönetici davetiyle personel açtığı için Supabase'de “Allow new users to sign up” kapatılır; mevcut kullanıcıların girişi ve yönetici davetleri korunur.

## Vercel production değişkenleri

Takvim bağlantısı açılmadan önce aşağıdaki değişkenler production ortamında tanımlanır:

- `NEXT_PUBLIC_APP_URL=https://abidinyildiz.com`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_STATE_SECRET` — en az 32 rastgele bayt
- `CALENDAR_TOKEN_ENCRYPTION_KEY` — 32 rastgele baytın base64 çıktısı

İstemci sırrı, state sırrı ve token şifreleme anahtarı hiçbir zaman `NEXT_PUBLIC_` önekiyle tanımlanmaz veya GitHub'a yazılmaz.

## Canlı kabul kriterleri

1. Giriş sayfasındaki “Google ile giriş yap” düğmesi doğru Google hesap seçim ekranını açar.
2. Aktif personelle aynı e-postadaki Google hesabı oturum açar; yönetici `/mfa` doğrulamasından sonra Dashboard'a ulaşır.
3. Personel kaydı olmayan bir Google hesabı CRM'e erişemez.
4. Yeni kullanıcı kaydı kapalıdır; tanımsız Google hesabı Auth kullanıcısı oluşturamaz.
5. Randevular sayfasındaki “Google Takvim'i bağla” akışı izin ekranını açar ve başarıyla CRM'e döner.
6. CRM randevusu Google Takvim'e yazılır; Google tarafındaki kontrollü değişiklik CRM'e geri alınır.
7. Bağlantı kaldırıldığında saklanan Takvim tokenları silinir.
8. Production health kontrolleri, ana dal CI ve Vercel deployment sonucu yeşildir.

Canlı kabul tamamlanmadan bu özellikler “production aktif” olarak işaretlenmez.

19 Ağustos sonucu:

- Kriter 1, 2, 5, 6 ve 8 production'da doğrulandı.
- Tanımsız hesap erişimi ve yeni kullanıcı engeli (kriter 3–4) otomatik
  güvenlik testleriyle doğrulandı; production'da sahte personel hesabı
  oluşturulmadı.
- Bağlantı kaldırma (kriter 7) çalışan production bağlantısını ve yenileme
  tokenını bilerek bozacağı için canlıda uygulanmadı; silme davranışı otomatik
  testlerle korunur.

## Kalan dış yönetişim işi

OAuth uygulaması production modunda olmakla birlikte Google'ın hassas Takvim
kapsamı için henüz doğrulanmış yayıncı değildir ve 100 kullanıcı sınırı taşır.
Daha geniş personel yayılımı öncesinde `abidinyildiz.com` üzerinde public
gizlilik politikası ve kullanım şartları yayımlanmalı, OAuth consent screen
alanları bu sayfalara bağlanmalı ve Google hassas kapsam doğrulamasına
gönderilmelidir. Bu eksik mevcut bağlı yöneticinin çalışmasını engellemez;
ölçekli yayılım ve güven ekranı için yönetişim kapısıdır.
