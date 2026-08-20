# Faz 5.7 — Google Doğrulama Hazırlığı ve Ürün Kararı

- Tarih: 20 Ağustos 2026
- Production alan adı: `https://abidinyildiz.com`

## Ürün kararı: WhatsApp Business ertelendi

Ürün sahibi 20 Ağustos 2026'da WhatsApp Business sağlayıcısının şimdilik
gerekli olmadığına karar verdi. Bu pakette WhatsApp Business API hesabı,
sağlayıcı anahtarı, webhook veya ücretli mesaj teslimi açılmaz. Mevcut kullanıcı
cihazında WhatsApp bağlantısı hazırlayan yardımcı akışlar korunur; harici
sağlayıcı üzerinden otomatik teslim yapılmaz. Yeniden değerlendirme ancak
gönderici işletme hesabı, maliyet, izin/ret politikası ve canlı kabul kapsamı
ayrıca onaylandığında başlar.

## Public doğrulama yüzeyi

Google'ın production OAuth uygulamalarında ana sayfanın yalnız giriş ekranı
olmaması şartına uygun olarak aşağıdaki anonim erişilebilir sayfalar eklendi:

- `https://abidinyildiz.com/` — uygulamanın sahibi, hedef kullanıcısı,
  işlevleri ve Google veri kullanımının özeti;
- `https://abidinyildiz.com/privacy-policy` — KVKK açıklaması, Google kullanıcı
  verisinin erişim/kullanım/saklama/paylaşım sınırları, Limited Use beyanı ve
  bağlantı kaldırma yöntemi;
- `https://abidinyildiz.com/terms` — yetkili personel kullanım şartları;
- `https://abidinyildiz.com/login` — mevcut personel giriş ve MFA akışı.

## Google veri minimizasyonu ve bağlantı kaldırma

- Takvim izni `calendar.events` yerine yalnız kullanıcının sahibi olduğu
  takvimlerdeki etkinliklere erişen daha dar `calendar.events.owned` kapsamına
  çekildi. CRM yalnız personelin birincil takvimini kullanır.
- Eşitleme artık birincil takvimdeki tüm değişiklikleri listelemek yerine yalnız
  CRM'in daha önce oluşturup kimliğini sakladığı bağlı etkinlikleri tek tek okur.
- Bağlantı kaldırılırken şifreli yenileme anahtarıyla Google'ın OAuth revoke
  endpoint'i çağrılır. Uzak iptal geçici olarak başarısız olsa bile yerel şifreli
  erişim/yenileme anahtarları silinir; bağlantılı etkinlik eşleme kayıtları
  veritabanı ilişkisiyle birlikte kaldırılır.
- Bağlama düğmesinden hemen önce veri kapsamı ve amaç açıklaması gösterilir.
  Kullanıcı bu açıklamadan sonra açık bir düğme eylemiyle Google izin akışını
  başlatır.

## Google Cloud alanları

Branding:

- App name: `Nobel Vize CRM`
- App home page: `https://abidinyildiz.com/`
- Privacy policy: `https://abidinyildiz.com/privacy-policy`
- Terms of service: `https://abidinyildiz.com/terms`
- User support email / developer contact: `bilgi@nobelvize.com`
- Authorized domain: `abidinyildiz.com`

Data Access:

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `https://www.googleapis.com/auth/calendar.events.owned`

Hassas kapsam gerekçesi:

> Nobel Vize CRM uses the calendar.events.owned scope only after an authorized
> staff member explicitly connects Google Calendar. The CRM creates visa
> appointment events on the staff member's primary calendar, reads only events
> previously linked by the CRM to import time, location, or cancellation
> changes, and updates or deletes those linked events when the CRM appointment
> changes. A narrower read-only scope is insufficient because two-way sync must
> create, update, and delete the staff member's own linked events. The app does
> not list or store unrelated calendar events.

## Doğrulama videosu senaryosu

Google hassas kapsam başvurusu için herkese açık olmayan (Unlisted) YouTube
videosu gerekir. Video kesintisiz ve İngilizce arayüz/açıklamayla şunları
göstermelidir:

1. Tarayıcı adres çubuğunda `abidinyildiz.com/login` ve Nobel Vize CRM adı.
2. Yetkili personel girişi ve MFA sonrasında Randevular ekranı.
3. Takvim bağlantısından hemen önce gösterilen veri açıklaması.
4. “Google Takvim'i bağla” eylemi, Google izin ekranındaki uygulama adı ve
   tarayıcı adresinde doğru OAuth istemci kimliği.
5. İzin verilen `calendar.events.owned` kapsamı.
6. CRM randevusunun Google Takvim'e yazılması.
7. Google'da yalnız bu bağlı etkinliğin zamanı/konumu değiştirilip CRM'e geri
   alınması.
8. Bağlantı kaldırma açıklaması; canlı kabul bağlantısını bozmayacak ayrı test
   hesabı/projesi üzerinde bağlantının ve Google yetkisinin kaldırılması.

Canlı yöneticinin çalışan production Takvim bağlantısı bu video için
kullanılmaz. Yıkıcı kaldırma adımı ayrı bir doğrulama kullanıcısı veya test
projesinde yapılır.

## Resmî dayanaklar

- Google sensitive scope verification:
  `https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification`
- Google API Services User Data Policy:
  `https://developers.google.com/terms/api-services-user-data-policy`
- Google Calendar scopes:
  `https://developers.google.com/workspace/calendar/api/auth`
- Google OAuth token revocation:
  `https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke`
- KVKK Aydınlatma Yükümlülüğünün Yerine Getirilmesi Rehberi:
  `https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/bff28bcd-c557-4f81-a577-0db565b2687e.PDF`

## Yayın kanıtı

Bu bölüm PR, ana dal CI, production deployment ve public HTTP kontrolleri
tamamlandıktan sonra gerçek kimliklerle doldurulur. Yerel test sonucu tek
başına production yayını sayılmaz.
