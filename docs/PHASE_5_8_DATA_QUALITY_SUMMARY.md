# Faz 5.8.1 — Salt okunur veri kalite özeti

Tarih: 2 Ekim 2026. Teslim sınırı: yerel uygulama ve yerel doğrulama.
Dal: `codex/phase58-data-quality-summary`; başlangıç main SHA: `18a698a`.
Bu belge production kapanışı değildir.

## Amaç ve kapsam

Görevler ekranına yalnız yöneticiler için kategori bazlı veri kalite özeti
eklendi. Mevcut veri kontrolü, görev oluşturma, atama ve tamamlama akışları
korunur. Ülke kuralı genişletme, haftalık ölçüm arşivi, müşteri düzeltme,
otomatik görev üretimi, bağımlılık yükseltme ve Google başvurusu bu paketin
parçası değildir.

Özet; aktif müşteri ve açık başvuru tabanını, yedi mevcut eksiklik kuralını,
eksikliğin açık görevde olup olmadığını, hiç görev açılmamış durumları,
tamamlanmış ama hâlâ eksik kayıtları ve susturulan görevleri ayırır. Geciken
veri görevleri, aktif sorumlusu olmayan görevler, yeniden taramada kapanma
adayları ve son yedi günde tamamlanmış görev sayıları görünürdür.

Aktif müşterilere bağlı açık başvuru yoksa yeterli operasyon verisi olmadığı
açıklanır; sıfır eksiklik başarı oranına dönüştürülmez. Arşivlenmiş müşterilere
bağlı kapanmamış başvurular yalnız sayısal uyarıdır: müşteri geri açılmaz,
başvuru kapatılmaz ve görev oluşturulmaz.

## Yetki ve veri sınırı

- `GET /api/tasks/data-quality` mevcut `requireAdmin()` üzerinden aktif
  personel, yönetici rolü ve şirket MFA politikasını uygular.
- Normal oturumun Supabase istemcisi/RLS kullanılır; service-role eklenmedi.
- Müşteri RLS'si arşiv kayıtlarını yöneticilerden de gizler. Arşiv uyarısı
  için arşiv ekranının mevcut, STABLE ve admin kontrollü
  `list_archived_customers_v1()` okuma fonksiyonu yeniden kullanılır; yalnız
  `id` seçilir. RLS veya function grant değiştirilmedi.
- Veri kalite ve operasyon görev senkronizasyonu RPC'leri bu endpointte
  çağrılmaz. Yeni endpoint görev veya müşteri verisine yazmaz.
- Kayıt kimlikleri, iletişim ve pasaport alanları yalnız sunucu hesabında
  kullanılır. Yanıt yalnız toplamlar, kategori etiketleri ve ölçüm zamanıdır.
- Yanıt `private, no-store`; eksik/başarısız okumada güvenli HTTP 503. Hata
  mesajı veritabanı ayrıntısı veya kısmi/sıfır başarı sonucu içermez.

## Sayım ve yorum sınırları

- Özet mevcut görev ekranının 250 kayıt limitini kullanmaz. Okumalar kararlı
  `id` sıralamasıyla sayfalanır, exact count ile tüm sonuç beklenir.
- API istenenden daha az satır döndürdüğünde gerçek alınan satır sayısından
  devam edilir. Sayım değişirse, beklenmedik boş sayfa/hata varsa veya bir
  sorgu 25.000 satırı aşarsa işlem tamamlanmamış sayılır; kısmi toplam
  gösterilmez. Bu güvenli sınır daha büyük kullanımda sunucu tarafı aggregate
  tasarımının ayrıca değerlendirilmesini gerektirir.
- Ayrı sorgular tek transaction snapshot değildir. Aynı sayıda kayıtla
  eşzamanlı güncelleme olursa anlık görünüm farklılaşabilir; UI bunu belirtir.
- İletişim kuralı en az bir kanal arar; iki kanalın veya format doğruluğunun
  zorunlu kabulü değildir. Profil eksikliği bir kategori kontrolü olarak sayılır.
- 1/3/7 gün mevcut varsayılan takip süreleridir; ürün SLA'sı değiştirilmedi.
- Görev kapanışı mevcut Veri Kontrolü yeniden çalıştırıldığında değerlendirilir.
  Alan düzenlenir düzenlenmez otomatik kapanış eklendiği iddia edilmez.
- Son yedi günde tamamlanan sayısı, haftalık başarı oranı veya operasyon
  kabulü değildir. Başlangıç ve bir haftalık gerçek kullanım ölçümü hâlâ gerekir.

## Yerel doğrulama

- Node 24; mevcut `package-lock.json` ile `npm ci`. Paket/lock diff'i yok.
- `npm run lint`, `npm run typecheck`, `npm test`: başarılı; 105 test.
- `npm run test:security`: başarılı; 19 test.
- `npm run build`: son kod ile başarılı.
- Yeni dört Chromium senaryosu başarılı: admin okumasının görevleri
  değiştirmemesi; anonim/danışman retleri; mobil/hata/yeniden deneme;
  pasif personel ve zorunlu MFA olmadan admin erişiminin reddi.
- Mevcut iki görev/bildirim regresyon senaryosu başarılı. Manuel görev
  oluşturma/tamamlama ve veri taraması sonrası yeni özetin yenilenmesi geçti.
  Toplam altı hedefli Chromium senaryosu çalıştırıldı; tüm proje E2E paketi
  bu adımda yeniden çalıştırılmadı.
- Mobil panelin WCAG 2 A/AA etiketli axe taramasında sıfır ihlal. Yatay
  tablo bölgesi klavye odağı alır; sayfa genelinde yatay taşma yok.

Tarayıcı testleri yalnız bu çalışmaya ait `crm-phase58-20261002` yerel Docker
stack'inde sentetik kayıtlarla yapıldı. Yeni stack'in ilk açılışında mevcut
migration zinciri uygulandı; shared DB reset veya production migration
yapılmadı. Yerel E2E betiği yalnız izole stack'te MFA fixture politikasını
ayarlar; zorunlu MFA ret testi politikayı geçici etkinleştirip geri yükler.

İlk build, başka checkout'a işaret eden node_modules bağlantısını Turbopack
reddettiği için durdu. Bağımlılıklar yerel kuruldu; test fixture'ındaki şemaya
uymayan null vize türü de düzeltilerek build tekrar geçirildi. İlk tarayıcı
koşusunda eksik resmi Chromium çalıştırıcısı kuruldu. Sonraki gerçek RLS
senaryosu arşiv sayımını yakaladı; mevcut salt okunur arşiv RPC'siyle düzeltildi.
Mobil erişilebilirlik taraması kaydırılabilir tablo odağını yakaladı; bölge
etiketi ve klavye odağı eklenerek tekrar geçirildi. Son build tekrarında sandbox
port/IPC izni hatası oluştu; hatalı derleme önbelleği silinmeden ayrı geçici
konuma taşındı ve izinli temiz build başarılı oldu. Kontroller kapatılmadı.

Test fixture sayıları kapanışta sıfır olarak doğrulandı. Yalnız bu çalışmaya
ait yerel stack durduruldu; verisi/yedeği korundu ve geçici project_id geri
alındı. Asıl checkout'taki kullanıcı değişiklikleri korunur.

## Açık bakım uyarıları

`npm run audit:production` high eşiğinde başarılıdır fakat
baseline-browser-mapping için 1 moderate uyarı vardır. Tüm bağımlılıkları
kapsayan `npm audit` ise brace-expansion, browserslist ve js-yaml için
3 high, toplam 4 uyarıyla başarısızdır. Bunlar mevcut lockfile'dadır; bu paket
sessiz audit fix veya bağımlılık yükseltmesi içermez. Ayrı bakım işi gerekir.

## Teslim ve geri dönüş

Yeni migration, şema, RLS/grant veya bağımlılık değişikliği yok. Yerel test
project_id ayarı teslim diff'ine alınmaz. Mevcut asıl checkout değişiklikleri
korundu. Remote push, PR, merge, CI ve production yayını bu yerel doğrulama
adımında yapılmadı. Yayın için ayrı onay ve kontrollü CI/merge kapıları gerekir.
Uygulama paketini geri almak yeni commit revert'iyle mümkündür; DB geri
dönüşü gerektirmez.

## Kaynaklar

- Mevcut veri kuralları: `supabase/migrations/202608020001_phase51_data_quality_tasks.sql`
- Mevcut arşiv okuması: `supabase/migrations/202607220001_customer_soft_delete.sql`
- [Supabase range](https://supabase.com/docs/reference/javascript/range)
- [Supabase select](https://supabase.com/docs/reference/javascript/select)
