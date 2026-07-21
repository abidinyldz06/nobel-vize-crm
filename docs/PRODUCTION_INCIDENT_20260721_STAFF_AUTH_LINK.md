# Production Olayı — Staff / Auth Bağlantısı

Tarih: 21 Temmuz 2026
Durum: **Tamamlandı**

## Belirti

Production oturumunda müşteri sayısı `0` görünüyordu. RLS politikaları aktif
personeli `public.current_staff_id()` üzerinden çözdüğü için `staff.user_id` ile
`auth.uid()` arasındaki kopukluk bütün müşteri satırlarını görünmez hale
getirebilir.

## Production ön kontrolü

Kişisel veriler ve kimlik değerleri rapora yazılmadan yapılan kontrolde:

- 3 aktif personel kaydının tamamı Auth kullanıcılarına bağlıydı.
- 3 bağlantının tamamında hem kullanıcı kimliği hem normalize edilmiş e-posta
  eşleşiyordu.
- Auth tarafında toplam 5 hesap vardı; 2 eski hesap herhangi bir personel
  kaydına bağlı değildi.
- Son giriş yapan hesap aktif `admin` personeline bağlıydı.
- Production'da 9 müşteri vardı; 7 müşteri atanmamış, 2 müşteri bir personele
  atanmıştı.

Bu nedenle ölçüm anında mevcut üç personel kaydında kopuk bağlantı kalmamıştı.
Yine de migration geçmişinde bağlantının elle düzeltilmesine ihtiyaç bırakmamak
ve aynı hatanın tekrarını önlemek için kalıcı hotfix hazırlandı.

## Kalıcı düzeltme

`202607210002_relink_staff_auth_users.sql` migration'ı:

1. Boş veya yinelenen personel e-postasında durur.
2. Her personel için Auth tarafında tam bir normalize edilmiş e-posta eşleşmesi
   arar; sıfır veya birden fazla eşleşmede durur.
3. Yanlış ya da çapraz `user_id` bağlantılarını tek transaction içinde temizler.
4. Personeli doğru Auth kimliğine bağlar.
5. Bağlantı post-condition'ı sağlanmazsa bütün işlemi geri alır.

## Regresyon kapsamı

- Auth kullanıcısının `current_staff_id()` ile doğru aktif personeli çözmesi.
- Bağlı admin kullanıcının RLS açıkken müşteri satırını okuyabilmesi.
- Mevcut `staff_user_fk` ve `uq_staff_user_id` korumalarının devam etmesi.

## Tamamlama kanıtları

| Kontrol | Sonuç |
|---|---|
| Yerel migration reset | Geçti |
| Yerel şema lint | Geçti, 0 bulgu |
| pgTAP | Geçti, 36/36 |
| Uygulama kalite kapısı | Geçti; lint, typecheck, 17/17 Node testi ve build |
| Playwright | Geçti, 5/5 |
| GitHub application | Geçti |
| GitHub database | Geçti |
| GitHub browser | Geçti |
| Vercel Preview | Geçti |
| Production migration | Geçti, yerel/uzak 9/9 |
| Production şema lint | Geçti, 0 bulgu |
| Aktif personel / doğru Auth bağlantısı | 3/3 |
| Yeniden bağlantı gereken personel | 0 |
| Aktif admin | 1 |
| Production müşteri sayısı | 9 |
| Canlı Vercel yayını | `READY` |
| Ana sayfa ve müşteri rotası smoke | HTTP 200 |

Hotfix [PR #9](https://github.com/abidinyldz06/nobel-vize-crm/pull/9)
üzerinden bütün kalite kapıları geçtikten sonra `main` dalına birleştirildi ve
migration Production'a uygulandı.

Mevcut erişim modelinde admin bütün müşterileri görür; danışmanlar yalnız
kendilerine atanmış müşterileri görür. Production'daki iki danışmana atanmış
müşteri bulunmadığı için danışman hesabında `0` görünmesi beklenen davranıştır.
Bu durum Auth bağlantı hatası değildir; müşteri ataması yapıldığında ilgili
danışmanın listesine yansır.
