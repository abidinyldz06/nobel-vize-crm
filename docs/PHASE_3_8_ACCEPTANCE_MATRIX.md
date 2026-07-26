# Faz 3.8 — Kullanıcı Kabul ve Rol Matrisi

Tarih: 26 Temmuz 2026

Kapsam: Nobel Vize tek şirketli iç CRM

Durum: Tamamlandı

## Amaç

Bu matris, Faz 3.8 boyunca hangi rolün hangi ekranı, veriyi ve işlemi
kullanabildiğini tek kabul kaynağında tanımlar. Tarayıcı kontrolleri tek başına
yeterli sayılmaz; aynı erişim sınırı sayfa, API ve Supabase RLS katmanlarında
ayrı ayrı doğrulanır.

## Roller

| Kimlik | Beklenen erişim |
|---|---|
| Admin | Tüm aktif müşteriler, tüm personel ve yönetim işlemleri |
| Aktif danışman | Yalnız kendisine atanmış müşteri, başvuru ve operasyon kayıtları |
| Pasif personel | Auth hesabı geçerli olsa bile iç CRM erişimi yok |
| Staff bağlantısı olmayan Auth hesabı | İç CRM erişimi yok; yöneticiye yönlendiren açıklayıcı hata |
| Anonim kullanıcı | Giriş sayfası dışındaki korumalı sayfalara ve API'lere erişim yok |

## Sayfa kabul matrisi

| Alan | Admin | Danışman | Pasif / bağlantısız |
|---|---:|---:|---:|
| Dashboard | Tüm şirket verisi | Kendi operasyon özeti | Engelli |
| Müşteri listesi | Tüm aktif müşteriler | Yalnız atanmış müşteriler | Engelli |
| Müşteri detay / edit / randevu | Tüm erişilebilir müşteriler | Yalnız atanmış müşteri | Engelli |
| Başvurular, görevler, bildirimler | Tüm yetkili kapsam | Yalnız kişisel kapsam | Engelli |
| Raporlar | Şirket geneli | Kendi performansı | Engelli |
| Arşiv | İzinli | Menüden gizli ve `/dashboard` yönlendirmesi | Engelli |
| Ülke ve evrak ayarları | İzinli | Menüden gizli ve `/dashboard` yönlendirmesi | Engelli |
| Personel listesi / yeni / edit / performans | İzinli | Menüden gizli ve `/dashboard` yönlendirmesi | Engelli |
| Sistem ve KVKK ayarları | İzinli | Menüden gizli ve `/dashboard` yönlendirmesi | Engelli |

## Veri ve işlem kabul matrisi

| Kaynak / işlem | Admin | Danışman |
|---|---|---|
| `customers` | Tüm aktif kayıtları okur ve yetkili işlemleri yapar | Yalnız `assigned_staff_id = current_staff_id()` |
| `applications` | Tüm başvurular | Yalnız erişebildiği müşterinin başvuruları |
| `documents`, `notes`, `payments` | Tüm erişilebilir başvurular | Yalnız kendi müşteri başvuruları |
| `tasks` | Yetkili kapsamda tüm görevler | Yalnız kendisine atanmış görevler |
| `notifications` | Yalnız kendi bildirimleri | Yalnız kendi bildirimleri |
| Global arama | Tüm erişilebilir sonuçlar | Başka danışmanın müşteri ve başvurusu dönmez |
| Evrak indirme | Yetkili evrak için kısa süreli bağlantı | Başka danışmanın evrakında 404 |
| Toplu arşiv / danışman atama | İzinli | 403 |
| Yedek, KVKK anonimleştirme ve veri paketi | İzinli | 403 |
| Başka danışmanın kaydını doğrudan güncelleme | İzinli | RLS nedeniyle sıfır kayıt |

## Otomatik kabul kanıtları

`e2e/phase38-role-isolation.spec.ts` aşağıdaki fixture setini geçici olarak
oluşturur:

- bir admin;
- iki aktif danışman ve her danışmana ait ayrı müşteri/başvuru/operasyon verisi;
- bir pasif danışman;
- staff bağlantısı olmayan bir Auth kullanıcısı.

Testler, tarayıcı sayfalarını, oturum çerezli API çağrılarını ve anon key ile
oturum açmış doğrudan Supabase istemcilerini birlikte kontrol eder. Cleanup
adımlarındaki her Supabase/Auth hatası testi düşürür; test sonunda personel ve
Auth fixture sayılarının sıfır olduğu ayrıca doğrulanır.

26 Temmuz 2026 ilk paket sonucu:

- 3 Playwright rol kabul testi geçti;
- admin-only üç personel alt URL'sine açık sayfa erişimi kapatıldı;
- danışman menüsünden Ülke & Evraklar, Personel ve Ayarlar kaldırıldı;
- müşteri, başvuru, evrak, not, ödeme, görev ve bildirim çapraz erişimi
  engellendi;
- çapraz update, toplu arşiv/atama ve yedek API yetkileri doğrulandı;
- pasif ve staff bağlantısız Auth hesapları reddedildi.

`e2e/phase38-critical-edge-flows.spec.ts` ile tamamlanan 3.8.3–3.8.4 kabul
kanıtları:

- geçersiz ve geçerli müşteri oluşturma, otomatik başvuru/evrak/not/audit,
  randevu, evrak onayı ve ödeme tek kritik zincirde doğrulandı;
- görev, bildirim, iletişim, portal, KVKK, arşiv, süreç, etiket, dashboard,
  hızlı eylem ve timeline kapsamı mevcut E2E senaryolarıyla birlikte korundu;
- verisiz danışmanın dashboard, müşteri, başvuru ve görev boş durumları
  doğrulandı;
- bozuk JSON ve eksik kaynakların 400/404 üretip veri değiştirmediği doğrulandı;
- eşzamanlı aynı durum geçişinde tek işlem ve tek audit, görev senkronizasyonu
  tekrarında kararlı kimlikler doğrulandı;
- fixture cleanup iki kez çalıştırıldı ve artık kayıt bırakmadı.

3.8.3–3.8.4 hedefli paket sonucu: **3/3 Playwright testi geçti**.

## Responsive, erişilebilirlik ve performans kabulü

`e2e/phase38-responsive-a11y-performance.spec.ts` ile tamamlanan 3.8.5
kanıtları:

| Kabul alanı | Ölçüm | Sonuç |
|---|---|---|
| Mobil | 390×844; giriş/dashboard/müşteri/başvuru/görev | Yatay taşma yok |
| Masaüstü | 1440×900; aynı kritik ekranlar | Yatay taşma yok |
| WCAG | axe-core; WCAG 2 A, AA, 2.1 A ve AA | 0 ihlal |
| Klavye | Skip-link, Enter ile menü açma, Escape ile kapatma | Geçti |
| Odak | Görünür focus ve kapanışta tetikleyiciye dönüş | Geçti |
| Hareket | `prefers-reduced-motion` | Destekleniyor |
| Performans | DCL ≤4 sn, load ≤5 sn, ≤120 kaynak, ≤4 MB, CLS ≤0,1 | Geçti |

Tarama kapsamı anonim giriş ile oturumlu admin dashboard ve müşteri
ekranlarının hem mobil hem masaüstü görünümünü içerir. Başvuru ve görev
ekranları responsive taşma regresyonuna dahildir. Performans testi Chromium
önbelleğini temizleyerek dashboard navigation/resource timing ve layout-shift
değerlerini ölçer.

3.8.5 hedefli paket sonucu: **4/4 Playwright testi geçti**.

## 3.8.7 kullanıcı kabul oturumu

Ürün sahibinin Faz 3 boyunca tanımladığı senaryolar release adayı üzerinde
gerçek Chromium oturumunda yürütülerek aşağıdaki kabul listesi tamamlandı:

- [x] Admin kritik günlük akışları gerçekçi, geçici fixture veriyle tamamladı.
- [x] Danışman kendi müşterisini yönetirken başka danışman verisini göremedi.
- [x] Mobil ve masaüstü temel ekranlar responsive ve WCAG kabulünden geçti.
- [x] Kritik hata mesajları, boş durumlar ve geri dönüş yolları doğrulandı.
- [x] Production öncesi yedek, rollback, restore ve health kapıları tanımlandı.
- [x] Tarih, yayın kapsamı ve bilinen sınırlamalar kapanış raporuna yazıldı.

Release/rollback ayrıntıları ve production doğrulama sırası
`docs/PHASE_3_8_RELEASE_AND_CLOSURE.md` dosyasındadır.
