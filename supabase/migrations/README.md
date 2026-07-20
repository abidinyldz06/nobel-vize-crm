# Veritabanı migration notları

Bu klasördeki dosyalar sıralı ve geri izlenebilir veritabanı değişiklikleridir.

## Uygulama kuralı

1. Canlı veritabanının yedeği alınır.
2. Migration önce staging Supabase projesinde uygulanır.
3. Login, admin, danışman, müşteri portalı, evrak yükleme ve indirme akışları test edilir.
4. Sonuçlar doğrulanmadan üretime uygulanmaz.

`supabase/schema_full.sql` temiz kurulum amacıyla tabloları silen komutlar içerir ve mevcut bir veritabanına migration olarak uygulanmamalıdır.

## Faz 0 ortam gereksinimi

Portal sunucu tarafında sınırlı sorgu çalıştırdığı için Vercel/Sunucu ortamında `SUPABASE_SERVICE_ROLE_KEY` bulunmalıdır. Bu değer hiçbir zaman `NEXT_PUBLIC_` önekiyle tanımlanmamalı veya tarayıcıya gönderilmemelidir.
