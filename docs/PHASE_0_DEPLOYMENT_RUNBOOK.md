# Faz 0 — Güvenli Yayın Rehberi

Bu paket kodu güvenli varsayımlara taşır ancak canlı Supabase değişiklikleri otomatik uygulanmaz. Aşağıdaki sıra korunmalıdır.

## 1. Vercel/Sunucu secret'ları

Staging ve production ortamlarında ayrı değerler kullanın:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_FORM_WEBHOOK_SECRET`
- `ENABLE_DANGEROUS_RESTORE=false`

Service-role ve webhook anahtarı yalnızca sunucuda bulunmalıdır.

## 2. Google Apps Script imzası

Webhook gövdesi oluşturulduktan sonra aynı ham JSON metni imzalanmalıdır:

```javascript
const timestamp = Math.floor(Date.now() / 1000).toString();
const eventId = Utilities.getUuid();
const rawBody = JSON.stringify(payload);
const bytes = Utilities.computeHmacSha256Signature(
  `${timestamp}.${eventId}.${rawBody}`,
  GOOGLE_FORM_WEBHOOK_SECRET,
);
const signature = bytes
  .map((byte) => (`0${(byte & 0xff).toString(16)}`).slice(-2))
  .join('');

UrlFetchApp.fetch(WEBHOOK_URL, {
  method: 'post',
  contentType: 'application/json',
  payload: rawBody,
  headers: {
    'x-webhook-timestamp': timestamp,
    'x-webhook-id': eventId,
    'x-webhook-signature': `sha256=${signature}`,
  },
  muteHttpExceptions: true,
});
```

Beş dakikadan eski istekler, imzası eşleşmeyen gövdeler ve aynı olay kimliğiyle tekrar gönderilen istekler reddedilir.

## 3. Staging veritabanı

1. Staging yedeği alınır.
2. `supabase/migrations/202607200001_phase0_lock_down_public_access.sql` uygulanır.
3. `supabase/migrations/202607200002_phase0_role_based_rls.sql` uygulanır.
4. Supabase policy listesinde dört `Portal Public Read*` politikasının bulunmadığı doğrulanır.
5. `documents` bucket'ının private olduğu doğrulanır.
6. `webhook_events` tablosunun oluştuğu ve `anon`/`authenticated` rollerinin tablo yetkisi olmadığı doğrulanır.

## İlk admin kurulumu

Otomatik “ilk kullanıcı admin olsun” davranışı güvenlik nedeniyle kaldırılmıştır. Mevcut sistemde admin personel kaydı zaten bulunmalıdır. Sıfırdan kurulumda:

1. İlk kullanıcı Supabase Auth panelinden kontrollü olarak oluşturulur.
2. Oluşturulan kullanıcının UUID değeri alınır.
3. SQL Editor'da yalnızca kurulum sorumlusu aşağıdaki kaydı gerçek değerlerle ekler:

```sql
INSERT INTO public.staff (user_id, full_name, email, role, is_active)
VALUES ('AUTH_USER_UUID', 'Yönetici Adı', 'admin@example.com', 'admin', true);
```

Sonraki tüm kullanıcılar uygulamadaki admin personel daveti üzerinden eklenir.

## 4. Regresyon kontrolleri

- Oturumsuz kullanıcı dashboard/API verisine erişemez.
- Aktif danışman yalnızca kendisine atanmış müşterileri görür.
- Danışman toplu silme ve personel atama yapamaz.
- Admin personel daveti gönderebilir.
- Portal geçerli token ile yalnızca ilgili müşterinin sınırlı verisini gösterir.
- Geçersiz token veri döndürmez.
- Evrak yüklenebilir; doğrudan public URL çalışmaz; uygulamadaki indirme düğmesi 60 saniyelik signed URL ile çalışır.
- İmzasız, yanlış imzalı ve eski webhook istekleri reddedilir.
- Doğru imzalı webhook bir kayıt oluşturur.
- Backup indirilebilir; restore varsayılan olarak devre dışıdır.

## 5. Geri dönüş

Kod geri alınabilir; ancak private bucket tekrar public yapılmamalı ve anonim portal politikaları geri eklenmemelidir. Portal sorununda güvenli çözüm kodu düzeltmek veya portalı geçici olarak kapatmaktır.
