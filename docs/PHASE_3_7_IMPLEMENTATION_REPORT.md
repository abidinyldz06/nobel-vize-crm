# Faz 3.7 — İzleme ve İş Sürekliliği Uygulama Raporu

Tarih: 26 Temmuz 2026
Durum: Tamamlandı; GitHub, production migration ve canlı doğrulama dahil

## Amaç ve sınırlar

Bu aşama, Nobel Vize CRM'deki teknik hataların kişisel veri sızdırmadan
izlenmesini, servis bağımlılıklarının güvenli biçimde kontrol edilmesini ve
veritabanı ile private Storage yedeklerinin gerçekten geri yüklenebilir olduğuna
dair tekrarlanabilir kanıt üretmeyi amaçlar.

Uygulama JSON yedeği veritabanı kayıtlarını ve Storage envanterini içerir;
Storage belge binary'lerini içermez. Felaket kurtarma paketi ancak DB çıktısı,
JSON yedeği ve private `documents` bucket içeriği birlikte, repo dışında
şifrelenerek saklandığında tamamlanmış sayılır.

## 3.7.1 — Yapılandırılmış loglar ve request ID — Bitti

- Uygulama ve API isteklerine UUID biçiminde request ID atanır ve yanıt
  başlığında döndürülür.
- API route'ları ortak gözlem wrapper'ı üzerinden durum ve süre ölçümü yapar.
- Log alanları allowlist ile sınırlandırılmıştır; müşteri adı, telefon, e-posta,
  pasaport, token, cookie, secret ve ham hata mesajı kaydedilmez.
- Beklenmeyen API hataları güvenli hata kodu ve request ID ile yanıtlanır.

## 3.7.2 — Liveness ve readiness — Bitti

- `/api/health/live` yalnız süreç yaşam durumunu bildirir.
- `/api/health/ready` gerekli ortam değişkenlerini, veritabanı sorgusunu ve
  private `documents` bucket erişimini sınar.
- Public sağlık yanıtı yalnız aggregate durum içerir; bağlantı bilgisi, tablo
  içeriği veya sağlayıcı hata mesajı döndürmez.
- Doğrulanmış yedek yaşı ayrıca izlenir; eski yedek runtime readiness'i
  düşürmeden operasyon uyarısı üretir.

## 3.7.3 — Operasyonel olaylar ve admin uyarıları — Bitti

- `operational_events` tablosu yalnız izinli olay anahtarlarını ve güvenli
  operasyon metadata'sını saklar.
- Aynı açık olay tekrarlandığında yeni kayıt üretmek yerine tekrar sayısı ve son
  görülme zamanı güncellenir.
- Kritik olaylar admin bildirimlerine bağlanır; olaylar yalnız admin tarafından
  çözüldü olarak işaretlenebilir.
- Ayarlar > Operasyon ekranı açık/kapalı olayları, kodu, route'u, request ID'yi
  ve tekrar sayısını gösterir.

## 3.7.4 — Yedekleme takibi ve doğrulama — Bitti

- `backup_runs` tablosu başlatılan, tamamlanan, başarısız ve doğrulanmış yedek
  geçmişini tutar.
- Yedek API'si sürümlü JSON, SHA-256, tablo/satır sayısı ve recursive private
  Storage nesne/boyut manifesti üretir.
- Tarayıcı indirilen gövdenin SHA-256 değerini yeniden hesaplar; eşleşme
  sağlandıktan sonra yedeği `verified` durumuna getirip indirir.
- Restore sırasında bağlı backup run varsa sunucu checksum'u tekrar doğrular.
- Son doğrulanmış yedek 36 saati geçtiğinde `backup.stale` açılır; başarılı yeni
  doğrulamada olay otomatik kapatılır.

## 3.7.5 — Restore tatbikatı ve olay rehberi — Bitti

- `npm run restore:drill` yalnız `127.0.0.1:54322` yerel Supabase adresine
  bağlanmayı kabul eder.
- Tatbikat backup v2 üretir, atomik restore'u aynı transaction içinde çalıştırır,
  tüm yedek tablolarını birebir karşılaştırır ve sonunda `ROLLBACK` yapar.
- Storage nesne sayısı ile bucket gizliliği restore öncesi ve sonrasında
  doğrulanır.
- Olay müdahale rehberi RPO/RTO hedeflerini, SEV seviyelerini, yedekleme
  prosedürünü, production restore kapılarını ve olay kapatma adımlarını içerir.

## 3.7.6 — Kalite ve yayın — Bitti

Tamamlanan yerel kanıtlar:

- migration zinciri sıfır veritabanından başarıyla kuruldu
- database lint: 0 şema hatası
- pgTAP: 230/230 başarılı
- uygulama ve güvenlik testleri: 40/40 başarılı
- Playwright tam paket: 12/12 başarılı
- iletişim popup regresyonu art arda 3/3 başarılı
- izole restore tatbikatı: başarılı; 24 tablo ve Storage bütünlüğü doğrulandı
- Supabase tarafından üretilen TypeScript veritabanı tipiyle repo tipi birebir
  eşleşti
- production dependency audit: 0 yüksek seviye açık
- Next.js production build: başarılı

GitHub ve production kanıtları:

- [PR #23](https://github.com/abidinyldz06/nobel-vize-crm/pull/23)
  application, database, browser ve Vercel kontrolleri geçtikten sonra squash
  merge edildi
- birleşen `92b5082` commit'i için `main` application, database ve browser kalite
  işlerinin tamamı başarılı oldu
- production öncesi auth/public/storage şeması ve verisi, roller ile gerçek
  private Storage nesnesi repo dışında AES-256-CBC/PBKDF2 ile şifrelendi
- continuity arşivi ayrı Keychain anahtarıyla bağımsız olarak açıldı; tar ve
  SHA-256 bütünlüğü doğrulandı, düz metin geçici dosya bırakılmadı
- dry-run yalnız `202607260001` ve `202607260002` migration'larını gösterdi;
  ikisi kontrollü biçimde production'a uygulandı
- yerel ve uzak migration geçmişi tamamen eşleşti; uzak public şema lint sonucu
  0 hata verdi
- migration öncesi/sonrası 9 müşteri, 3 personel, 7 başvuru ve 1 private Storage
  nesnesi korundu; 3 personelin Auth bağlantısının tamamı geçerli kaldı
- `operational_events` ve `backup_runs` RLS koruması açık, authenticated doğrudan
  yazma yetkileri kapalı ve `documents` bucket private olarak doğrulandı
- Vercel production deployment `Ready` durumuna geldi ve
  `abidinyildiz.com` alan adına bağlandı
- canlı liveness ve readiness 200 döndü; yanıtlar yalnız minimal aggregate
  durum ile UUID request ID içerdi
- geçici admin ile canlı giriş, 9 müşterinin görünürlüğü, Operasyon ekranı,
  readiness ve SHA-256 doğrulamalı yedek indirme akışı başarıyla tamamlandı
- production uygulama yedeği 24 veritabanı tablosu ve 1 Storage nesnesi
  envanteriyle `verified` durumuna geldi; ayrı AES-256 şifreli dosya olarak
  saklandı ve bağımsız açma/JSON bütünlük kontrolünden geçti
- geçici production personel ve Auth kullanıcısı temizlendi; final durumda
  3 personel, 0 test kimliği, 1 doğrulanmış yedek ve 0 açık stale yedek olayı
  bulundu

## Migration envanteri

- `202607260001_phase37_operational_events.sql`
- `202607260002_phase37_backup_runs.sql`

## Güvenlik kararları

- Olay özeti kullanıcı girdisinden alınmaz; veritabanındaki izinli olay
  anahtarından üretilir.
- Operasyon ve yedek tablolarında doğrudan authenticated yazma yetkisi yoktur;
  yazmalar kontrollü RPC'lerden geçer.
- Public health endpoint'leri secret, sağlayıcı ayrıntısı veya kişisel veri
  göstermez.
- Uygulama yedeği Auth kullanıcılarını ve Storage binary'lerini içermez.
- Production restore yalnız ayrı acil durum yedeği, checksum, izole tatbikat ve
  ikinci kontrol kanıtından sonra açılır.

## İlgili rehber

Olay müdahale, yedekleme ve geri yükleme prosedürü:
`docs/PHASE_3_7_INCIDENT_AND_RECOVERY_RUNBOOK.md`.
