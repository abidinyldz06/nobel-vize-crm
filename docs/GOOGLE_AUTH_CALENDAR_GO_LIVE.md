# Google ile Giriş ve Google Takvim Canlıya Alma Kaydı

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
