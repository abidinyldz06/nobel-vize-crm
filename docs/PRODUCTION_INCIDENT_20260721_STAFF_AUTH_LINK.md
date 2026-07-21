# Production Olayı — Staff / Auth Bağlantısı

Tarih: 21 Temmuz 2026
Durum: **Düzeltme hazırlanıyor**

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

Production uygulaması, migration, RLS görünürlüğü ve CI doğrulamaları
tamamlandıktan sonra bu bölüm sonuçlarla güncellenecektir.
