# 9 Eylül — Veri kalitesi iç fonksiyon yetkisi

## Kök neden ve değişiklik

`202608020001` yalnız PUBLIC yetkisini kaldırıyor. Supabase'in ayrıca
verdiği anon/authenticated EXECUTE yetkisi bundan etkilenmiyor. İç fonksiyon
SECURITY DEFINER olarak görev yazıyor; dış kullanıcılar yalnız yönetici
kontrollü `sync_data_quality_tasks_v1()` üzerinden ulaşmalıdır.

Yeni `202609090001` migration'ı yalnız bu fonksiyonun PUBLIC, anon ve
authenticated yetkilerini kaldırır. Tablo/veri silmez, tip veya imza
değiştirmez. Fonksiyon sahibinin çağrısı korunur. Mevcut yönetici sync
testleri ve iki rol için doğrudan çağrı ret testleri birlikte çalışır.

## Yayın öncesi salt okunur kontrol

Doğru staging/production projesinin SQL Editor'ında yalnız bu sorgu çalışır:

```sql
SELECT current_database(), r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'upsert_data_quality_task_v1'
  AND r.rolname IN ('anon', 'authenticated', 'service_role');
```

Production etkisi bu sorguyla ayrıca doğrulanmalıdır; CI bulgusu canlı
ortam kanıtı olarak sunulmaz. Gerçek müşteri verisi veya token sorgulanmaz.

## Uygulama ve geri dönüş

Önce staging'de yeni migration ve yönetici veri kalitesi senaryosu doğrulanır.
Production uygulaması ayrıca açık yetki ve güncel recovery point doğrulaması
gerektirir. Tam hedef yalnız yukarıdaki iç fonksiyonun erişim listesidir.
Eski uygulama aynı kontrollü sync girişini kullandığından uyumludur.
Sorunda anon/authenticated erişimini geri açmak yerine fonksiyon sahipliği
ve kontrollü çağrı zinciri ileri-düzeltmeyle ele alınır. Veri restore gerekmez.

## Bağımlılık güvenliği

Bugünkü production audit, sabit sharp 0.35.3 için yüksek güvenlik uyarısı
verdi. Override yalnız 0.35.4'e yükseltildi; ilgili native paketler npm
lockfile ile güncellendi. Kaynaklar:

- https://github.com/advisories/GHSA-rgj7-g3m4-5g8c
- https://github.com/lovell/sharp/releases/tag/v0.35.4

Yerel Docker kapalı olduğundan yerel DB reset/restore çalıştırılmadı.
PR Quality Gates izole runner üzerinde migration, tip karşılaştırması,
DB, restore ve tarayıcı kabulünün kaynak noktasıdır.
