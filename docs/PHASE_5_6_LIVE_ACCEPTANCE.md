# Faz 5.6 — Production Sağlayıcı Canlı Kabulü

- Tarih: 19 Ağustos 2026
- Saat dilimi: Europe/Istanbul
- Production: `https://abidinyildiz.com`

## Sonuç

Resmî şirket iletişim alanları, Resend gerçek e-posta teslimi, Google ile giriş
ve Google Takvim iki yönlü eşitlemesi production'da doğrulandı. Canlı Takvim
kabulünün ilk turunda bulunan eşitleme sırası kusuru PR #66 ile düzeltildi;
deployment sonrasında aynı gidiş-dönüş senaryosu geçti.

## Şirket iletişim ve e-posta kanıtı

- Şirket: Nobel Vize
- E-posta: `bilgi@nobelvize.com`
- Birincil telefon: `+90 533 499 57 50`
- Resmî kaynak: `https://www.nobelvize.com/iletisim/`
- Production doğrulama zamanı: `2026-08-19T12:58:28.792483Z`
- Resend canlı test kaydı: kanal `email`, sağlayıcı `resend`, durum
  `delivered`, kabul zamanı `2026-08-19T08:42:34.610872Z`, delivery webhook
  zamanı `2026-08-19T08:42:39.586249Z`, son hata kodu yok.

## Google Takvim gidiş-dönüş senaryosu

Yalnız kabul için `FAZ56 TEST TAKVIM` adlı sentetik müşteri ve açıkça test
olarak etiketlenmiş bir Almanya turistik başvurusu kullanıldı.

1. CRM randevusu `20.08.2026 14:30`, konum
   `FAZ 5.6 TEST - Nobel Vize Ankara` olarak oluşturuldu.
2. Manuel eşitleme başarılı oldu; Google event kimliği
   `4s4projakq5uhfn138t60pkguc` ile bağlantı satırı oluştu.
3. Google Takvim'de etkinlik `15:15–16:15` aralığına alındı ve konum
   `FAZ 5.6 TEST - Google Güncellemesi` yapıldı.
4. İlk kabul turunda CRM eşitlemesi bu değişikliği eski 14:30 değerleriyle
   ezdi. Kök neden, dışa aktarımın uzaktaki değişiklikleri okumadan önce
   çalışmasıydı.
5. PR #66 ile uzaktaki değişiklikleri önce içeri alan, sonra güncel CRM
   görünümünü dışa gönderen sıra uygulandı. Aynı çevrimde iki taraf da
   değişmişse bağlı Google etkinliği belirleyici kabul edildi.
6. Production deployment sonrasında senaryo tekrarlandı. CRM başvurusu
   `2026-08-20T12:15:00Z`, konum
   `FAZ 5.6 TEST - Google Güncellemesi`, durum `rescheduled` olarak güncellendi.
7. `appointment_events` kaydı “Google Takvim değişikliği CRM'e işlendi.” notuyla
   ve activity log “Google Takvim” aktörüyle oluştu. Sonraki dışa aktarım Google
   etkinliğini yeniden 14:30'a çevirmedi.

## Yayın ve kalite kanıtı

- PR #66 doğrulanan baş commit:
  `506da2c6742e2b13a36b35fa6c6c22d1c9a636e7`
- PR #66 kontrollü squash merge commit:
  `4ea59ebf2ab1991df02d512fd536ac14f7026bf9`
- PR Quality Gates run `32257231531`: application, database ve browser
  işleri başarılı; Vercel preview başarılı.
- Production deployment: `dpl_Eh9sGkNNvzK7zYSqS4CSDcc9Qbbv`, target
  `production`, durum `READY`, alias `abidinyildiz.com`.
- Ana dal Quality Gates run `32258157344`: application, database ve 30 browser
  senaryosu başarılıdır.

## Test verisi temizliği

- Sentetik randevu CRM'de `cancelled` yapıldı ve tekrar eşitlendi.
- Google bağlantı kaydında `remote_deleted_at=2026-08-19T13:30:17.36Z`
  oluştu; Google Takvim'de test etkinliği kalmadı.
- Yalnız sentetik müşteri `2026-08-19T13:30:52.756249Z` zamanında geri
  yüklenebilir arşive taşındı.
- Production aktif müşteri sayısı temizlik sonrasında yeniden `0` olarak
  doğrulandı. Gerçek müşteri kaydı değiştirilmedi veya silinmedi.

## Dürüst kalan işler

- Google OAuth uygulaması `In production` olsa da hassas Takvim kapsamı için
  yayıncı doğrulaması ve 100 kullanıcı sınırı devam eder. Public gizlilik
  politikası, kullanım şartları ve Google doğrulama başvurusu daha geniş
  personel yayılımından önce tamamlanmalıdır.
- Çalışan production Takvim bağlantısını koparıp yeniden yetkilendirme
  gerektireceği için “bağlantıyı kaldır” akışı canlıda yıkıcı kabul testine
  sokulmadı; token silme davranışı otomatik testlerle korunur.
- WhatsApp Business entegrasyonu bu fazın parçası değildir ve ayrı ürün/maliyet
  kararı bekler.
