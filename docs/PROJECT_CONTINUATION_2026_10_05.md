# 5 Ekim 2026 — Cursor sonrası devam ve teslim sınırı

## Doğrulanmış yayın durumu

- [PR #82](https://github.com/abidinyldz06/nobel-vize-crm/pull/82): README/rapor eşitlemesi birleşti.
- [PR #83](https://github.com/abidinyldz06/nobel-vize-crm/pull/83): admin arşiv ekranındaki açık başvuruların salt okunur incelemesi birleşti. Otomatik kayıt kapatma/geri açma yok.
- [PR #84](https://github.com/abidinyldz06/nobel-vize-crm/pull/84): hedefli bağımlılık bakımı birleşti.
- Güncel main: `0bcf4d4a6eef1a038a8c65d3b4866cc54a3f035f`.
- [Main Quality Gates 37189258830](https://github.com/abidinyldz06/nobel-vize-crm/actions/runs/37189258830): application, database ve browser başarılı.
- GitHub Production deployment `6838768635`: aynı SHA, success.
- [Zamanlanmış production audit 37255930558](https://github.com/abidinyldz06/nobel-vize-crm/actions/runs/37255930558): başarılı.

Bu yayın kanıtları PR #85 adayını veya bu belgenin yerel değişikliklerini
production'a alınmış yapmaz. MFA, gerçek e-posta ve Google Takvim için geçmiş
kabul kanıtları vardır; bu çalışmada yeniden canlı kullanıcı kabulü yapılmadı.

## PR #85 — kök neden ve düzeltme kapsamı

[PR #85](https://github.com/abidinyldz06/nobel-vize-crm/pull/85),
`2cb427d90ddee261afe6d158d35420adca00142f` başlığında yedi patch/minor
bağımlılık güncellemesi içerir. [CI 37256048025](https://github.com/abidinyldz06/nobel-vize-crm/actions/runs/37256048025)
application işini geçti; generated-type karşılaştırması başarısız oldu ve
browser işi bu nedenle çalışmadı.

Supabase CLI 2.119.0 yerel tip üretimini postgres-meta konteynerinden yerel
üreticiye taşıdı. Çıktı biçimi değişti ve `NOT NULL` jsonb alanları artık
`NonNullable<Json>` olarak üretiliyor. Kaynak:
[Supabase CLI #6652](https://github.com/supabase/cli/pull/6652).
Bu yalnız boşluk farkı değildir; tipler şemadan yeniden üretilmelidir.
Byte-for-byte CI karşılaştırması korunur. Üreticinin satır sonu boşlukları
aynı `sed` işlemiyle temizlenir; bu işlem alan, tip veya yetki farklarını
yok saymaz. Tip dosyası bu aynı komutun çıktısıdır.
Yeni migration, RLS/grant değişikliği ve production veri işlemi kapsam dışıdır.

Next.js 16.3.8 güvenlik yamaları da içerir; güncelleme yalnız CLI sorunundan
ötürü sessizce paketten çıkarılmaz. Kaynak:
[resmi Next.js 16.3.8 sürüm notu](https://github.com/vercel/next.js/releases/tag/v16.3.8).

## Yerel doğrulama

İzole dal: `codex/pr85-generated-types`.
Geçici checkout: `/private/tmp/crm-pr85-types-20261005`.
Ana uygulama checkout'ındaki kullanıcı değişikliklerine dokunulmadı.
Lockfile'dan `npm ci` tamamlandı. İlk kontrol turunda lint, 110/110 test ve
production audit (0 açık) geçti. Geliştirme zincirindeki beş high audit
uyarısı bu sonuçtan ayrı tutulur; `npm audit fix --force` yapılmadı.

Yeni üreticide ayrıca hesaplanan `leads.*_normalized` alanları Insert/Update
için `never`, parametresiz RPC Args alanları `Record<PropertyKey, never>`
olmuştur. İlk değişiklik migration'daki `GENERATED ALWAYS` tanımıyla
uyumludur. Uygulama typecheck ve build'i bu tiplerle başarılıdır.

Yerel şema sıfırdan, yalnız bu çalışma için oluşturulan
`crm-pr85-types-20261005` Docker stack'inde migration zinciriyle kuruldu.
Mevcut veya production DB resetlenmedi. Typecheck, production build,
DB lint (0 hata) ve pgTAP (14 dosya, 437/437 test) geçti.
Tip üretimi ikinci çalıştırmada eşleşti. Playwright Chromium 36/36 test
başarılıdır. `git diff --check` temizdir. Test sırasında bir Next dev
"destination stream closed early" logu görüldü; testler başarısız olmadı.
Bu log tek başına doğrulanmış production hatası olarak sunulmaz.

`db:reset` çalıştırılmadı: mevcut veri silinmesi yerine sıfırdan yeni,
izole stack migration kurulumu kullanıldı. `restore:drill` çalıştırılmadı:
betik sabit `supabase_db_nobel-vize-crm` hedefi bekler; başka bir stack'e
yönlendirilmedi veya kontrolü kaldırılmadı. Güncel aday için GitHub CI'ın
reset/restore dahil tam turu hâlâ gereklidir. Yerel sonuçlar remote CI veya
canlı kullanıcı kabulü değildir.

Geçici project_id değişikliği teslim diff'inden çıkarılmıştır. Production
config/migration değişmez. Yerel test stack'i veriler korunarak durdurulur;
Docker'daki diğer uygulamalar ve eski worktree'ler değiştirilmez.

## Teslim sınırı

Bu çalışma yerel düzeltme ve rapor hazırlığıdır. Remote push, yeni PR veya
#85 başlığının güncellenmesi, merge ve production deploy henüz yapılmadı.
Yayın adımı için hedef dal/PR ve canlıya geçiş onayı ayrı doğrulanır. GitHub
CI yeşil olmadan yerel test başarısıyla birleştirme yapılmaz.

## Kalan işler — bağımlılık ve kabul sınırları

1. **#85:** şemadan tip üretimi, uygulama/DB/browser kapıları, ardından açık
   yayın yetkisiyle push/PR/main/production doğrulamasını ayrı kaydet.
2. **Arşivli açık başvurular:** admin arşiv ekranı hazır. Ürün sahibi her
   kayıt için arşivde tut / müşteri geri aç / başvuruyu sonuçlandır kararını
   verir. İzin olmadan canlı kayıt değişmez. 2 Ekim'deki beş kayıt sayısı
   tarihsel ölçümdür; 5 Ekim canlı sayımı değildir.
3. **Bir haftalık gerçek kullanım:** gerçek aktif başvuru, sorumlu ve süre
   belirle; eksik alan, görevin kapanma süresi ve tekrar açılmayı ölç.
   Sıfır örneklemden başarı oranı çıkarma.
4. **Google:** Branding ile hassas kapsam/Data Access ayrıdır. Konsolun
   güncel durumu ve gerekli demo video kullanıcıyla doğrulanır; otomatik
   doğrulama başvurusu yapılmaz.
5. **Ülke kuralları:** sonraki gerçek başvuru ülkesi/profili seçilir. Fransa
   için resmi Visa Assistant profil çıktısı olmadan genel evrak listesi
   doğrulanmış diye sunulmaz. Kaynak, kontrol ve geçerlilik tarihleri gerekir.
6. **Operasyon:** gerçek kullanımda e-posta teslimi/retry, takvim bağlantısı,
   portal evrak ve yedek geri yükleme kabulü ölçülür. Yeni özellik paketi
   bu bakım çalışmasına eklenmez.

WhatsApp Business ertelenmiştir. Outlook ve çok kiracılı ürün bu kapsamda
başlatılmaz. Yazılım teslimi, kayıt kararı ve dış sağlayıcı onayı ayrı kapanır.
