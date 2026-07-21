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

Durum: **Devam ediyor — production yayını bekleniyor**

- [x] SaaS planı, abonelik, kota ve yükseltme bileşenlerinin kaldırılması
- [x] Public fiyatlandırma sayfasının kaldırılması
- [x] Subdomain ve white-label ifadelerinin temizlenmesi
- [x] Şirket ayarlarının tek kayıtlı iç CRM davranışına dönüştürülmesi
- [x] Çalışmayan bildirim seçeneklerinin kaldırılması
- [x] Yerel uygulama, veritabanı ve tarayıcı regresyonları
- [ ] Production migration, yayın ve smoke doğrulaması

### Faz 3.3 — Görev ve gerçek bildirim sistemi

Durum: **Bekliyor**

- Personel bazlı görevler ve bildirimler
- Randevu, eksik evrak, ödeme ve hareketsizlik hatırlatmaları
- Bugün, geciken ve yaklaşan işler ekranı
- Tekrarlı otomatik görevleri engelleyen idempotency kuralları

### Faz 3.4 — Başvuru süreç panosu

Durum: **Bekliyor**

- Başvuru durumları için operasyon panosu
- Personel, ülke, tarih ve gecikme filtreleri
- Kontrollü durum geçişleri ve atomik audit kaydı

### Faz 3.5 — Müşteri iletişimi ve portal

Durum: **Bekliyor**

- Yönetilebilir WhatsApp ve e-posta şablonları
- İletişim geçmişi ve başarısız gönderim kaydı
- Portalda başvuru, evrak, randevu ve ödeme özetinin iyileştirilmesi

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
