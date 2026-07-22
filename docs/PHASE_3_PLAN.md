# Faz 3 — İç CRM Ürünleştirme ve Operasyon Planı

Başlangıç: 20 Temmuz 2026
Ürün kararı: Nobel Vize için tek şirketli iç CRM
Durum: Devam ediyor

## Amaç

Faz 3, sistemi çok kiracılı SaaS'a dönüştürmeden Nobel Vize'nin günlük
operasyonunda güvenle kullanılabilen bir iç CRM sürümüne taşır. Tenant
izolasyonu, abonelik, paket, kota, self-service onboarding, white-label ve
subdomain geliştirmeleri bu fazın kapsamında değildir.

## Çalışma yöntemi

- Alt aşamalar aşağıdaki sırayla uygulanır.
- Her alt aşama ayrı değişiklik paketi ve doğrulama kanıtı üretir.
- İlgili kalite kontrolleri geçmeden commit veya push yapılmaz.
- Bir alt aşama staging/production kanıtı gerektiriyorsa bu kanıt alınmadan
  tamamlandı olarak işaretlenmez.
- Tamamlanan her aşama README, teknik yol haritası ve uygulama raporunda
  `Tamamlandı` olarak güncellenir.

## Alt aşamalar

### Faz 3.1 — Staging ve production hazırlığı

Durum: **Tamamlandı — 21 Temmuz 2026**

- [x] Faz 2'nin `main` dalına alınması
- [x] Faz 3 dalının güncel `main` üzerinden açılması
- [x] Sağ üst profil menüsü yayın engelinin giderilmesi
- [x] Profil menüsü için oturumlu Playwright regresyon testi
- [x] Supabase CLI oturumu ve doğru CRM production projesinin belirlenmesi
- [x] Production şema envanteri ve migration öncesi veri kalite kontrolü
- [x] Şifreli production veritabanı ve Storage mantıksal yedeği
- [x] Canlı veri kopyasında Faz 0–1 migration provası
- [x] Ayrı staging yerine kullanıcı kararıyla mevcut `CRM` production projesinde
  şifreli yedek, canlı veri kopyası provası ve kontrollü geçiş uygulanması
- [x] Faz 0–1 migration zincirinin production'a uygulanması
- [x] Production veri kalite, RLS, constraint ve private Storage kontrolleri
- [x] Rol, portal, Storage, webhook ve backup doğrulama regresyonları
- [x] Repo dışında şifreli production mantıksal yedeğinin geri açılarak doğrulanması
- [x] Vercel Production secret'larının tamamlanması ve kontrollü yeniden yayın
- [x] `abidinyildiz.com` üzerinde geçerli/geçersiz portal smoke kontrolleri

### Faz 3.2 — Tek şirket arayüz temizliği

Durum: **Tamamlandı — 21 Temmuz 2026**

- [x] SaaS planı, abonelik, kota ve yükseltme bileşenlerinin kaldırılması
- [x] Public fiyatlandırma sayfasının kaldırılması
- [x] Subdomain ve white-label ifadelerinin temizlenmesi
- [x] Şirket ayarlarının tek kayıtlı iç CRM davranışına dönüştürülmesi
- [x] Çalışmayan bildirim seçeneklerinin kaldırılması
- [x] Yerel uygulama, veritabanı ve tarayıcı regresyonları
- [x] Production migration, yayın ve smoke doğrulaması

### Acil Paket H2 — Müşteri veri güvenliği ve arşiv

Durum: **Tamamlandı — 22 Temmuz 2026**

Bu paket Faz 3 numaralandırmasını değiştirmez. Mevcut hard delete davranışının
veri kaybı riski nedeniyle Faz 3.3'ten önce uygulanır.

- [x] Müşteriler için soft delete alanları ve indeksleri
- [x] Yalnız admin tarafından çalıştırılabilen atomik arşiv/geri yükleme akışı
- [x] Silme ve geri yükleme audit kayıtları
- [x] Normal sorgulardan arşiv kayıtlarının çıkarılması
- [x] Admin Arşiv ekranı
- [x] 30 günü geçen kayıtlar için kontrollü manuel kalıcı silme
- [x] pgTAP, uygulama ve Playwright regresyonları
- [x] Production migration ve yayın doğrulaması

### Faz 3.3 — Görev ve gerçek bildirim sistemi

Durum: **Tamamlandı — 22 Temmuz 2026**

- [x] **3.3.1 bitti:** personel bazlı görev ve alıcı bazlı gerçek bildirim veri modeli
- [x] **3.3.2 bitti:** görev oluşturma, durum güncelleme ve kişisel okundu RPC'leri
- [x] **3.3.3 bitti:** randevu, eksik evrak, ödeme ve hareketsizlik görev üreticileri
- [x] **3.3.4 bitti:** Bugün, Geciken, Yaklaşan ve Tamamlanan görev ekranı
- [x] **3.3.5 bitti:** otomatik görevler için idempotency ve atanan personel erişim kuralları
- [x] **3.3.6 bitti:** backup/restore kapsamı, pgTAP, güvenlik ve Playwright regresyonları
- [x] **3.3.7 bitti:** GitHub kalite kapıları, production migration, yayın ve smoke doğrulaması

Ayrıntılı uygulama ve doğrulama kaydı:
`docs/PHASE_3_3_IMPLEMENTATION_REPORT.md`.

### Faz 3.4 — Başvuru süreç panosu

Durum: **Tamamlandı — 22 Temmuz 2026**

- [x] **3.4.1 bitti:** başvuru süreç panosu, operasyon filtreleri ve kontrollü/atomik durum geçişleri
- [x] **3.4.2 bitti:** müşteri edit/detay ekranlarında kanonik ülke, vize ve başvuru profil alanları
- [x] **3.4.3 bitti:** RLS korumalı müşteri etiketleri, renkli badge ve etiket filtresi
- [x] **3.4.4 bitti:** dashboard pasaport uyarıları ve aylık başvuru/onay/red/bekleyen/gelir istatistikleri
- [x] **3.4.5 bitti:** telefon, WhatsApp, e-posta, atomik hızlı not ve birleşik müşteri timeline'ı
- [x] **3.4.6 bitti:** GitHub kalite kapıları, production migration, yayın ve canlı smoke doğrulaması

Ayrıntılı uygulama ve doğrulama kaydı:
`docs/PHASE_3_4_IMPLEMENTATION_REPORT.md`.

### Faz 3.5 — Müşteri iletişimi ve portal

Durum: **Tamamlandı — 22 Temmuz 2026**

- [x] **3.5.1 bitti:** admin tarafından yönetilen WhatsApp ve e-posta şablonları
- [x] **3.5.2 bitti:** ortak mesaj hazırlayıcı ve kontrollü değişken çözümleme
- [x] **3.5.3 bitti:** atomik iletişim kaydı, gönderim/başarısızlık durumu ve audit izi
- [x] **3.5.4 bitti:** süreli portal bağlantısı yenileme, devre dışı bırakma ve yeniden açma
- [x] **3.5.5 bitti:** portal başvuru, evrak, randevu, ödeme, geçmiş ve şirket iletişim özeti
- [x] **3.5.6 bitti:** GitHub kalite kapıları, production migration, yayın ve canlı doğrulama

Not: WhatsApp ve e-posta işlemleri kullanıcının cihazındaki ilgili uygulamayı
açar. Harici bir gönderim sağlayıcısı bağlı olmadığı için sistem teslimatı
otomatik olarak iddia etmez; personel sonucu iletişim kaydında işaretler.

Ayrıntılı uygulama ve doğrulama kaydı:
`docs/PHASE_3_5_IMPLEMENTATION_REPORT.md`.

### Faz 3.6 — KVKK ve veri yaşam döngüsü

Durum: **Bekliyor**

- Aydınlatma/rıza sürüm kayıtları
- Veri dışa aktarma, arşivleme ve kontrollü anonimleştirme
- Veritabanı ve Storage yaşam döngüsünün birlikte yönetilmesi
- Kişisel veri ve secret maskeleme

### Faz 3.7 — İzleme ve iş sürekliliği

Durum: **Bekliyor**

- Yapılandırılmış log ve request kimliği
- Sağlık kontrolü, hata izleme ve uyarılar
- Veritabanı ile Storage yedekleme takibi
- Geri yükleme tatbikatı ve olay müdahale rehberi

### Faz 3.8 — Son kalite ve kullanıcı kabulü

Durum: **Bekliyor**

- Admin ve danışman rol regresyonları
- Kritik kullanıcı akışlarının Playwright kapsamı
- Migration, RLS, audit, build ve dependency kontrolleri
- Staging kullanıcı kabulü ve production yayın raporu

## Faz 3 dışı

Aşağıdaki tetikleyicilerden biri oluşana kadar SaaS mimarisi uygulanmaz:

- İkinci bağımsız şirketin aynı sistemde barındırılması
- Ücretli self-service onboarding kararı
- Tenant bazlı sözleşme, paket veya faturalandırma ihtiyacı

Bu tetikleyiciler oluşursa ADR 0001 yeniden değerlendirilir ve tenant izolasyonu
ayrı bir güvenlik/migration fazı olarak planlanır.
