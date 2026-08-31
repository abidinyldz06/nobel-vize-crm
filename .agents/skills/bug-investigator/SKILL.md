---
name: bug-investigator
description: Nobel Vize CRM'de bildirilen hata veya regresyonu yeniden üret, kök nedenini bul ve istenmişse en küçük düzeltmeyi doğrula. Yeni özellik veya yalnız sürüm hazırlığı için kullanma.
---

# Hata araştırma

1. Kök `AGENTS.md`, `README.md`, ilgili runbook ve mevcut implementasyonu oku. Beklenen/gerçek davranışı, etkilenen müşteri akışını ve güvenli yeniden üretim adımlarını belirle; production verisini değiştirme.
2. Hatayı yerel/test ortamında yeniden üret. İlgili testleri ve secret/müşteri verisi içermeyen logları incele; belirti ile kök nedeni ayır. Yeniden üretilemiyorsa kanıtı ve belirsizliği açıkça belirt.
3. Yalnız analiz istenmişse bulguyu raporla. Düzeltme istenmişse mevcut component/util/dependency'leri kullanarak en küçük değişikliği yap; kapsam dışı refactor yapma. Test, safeguard, migration veya doküman kaldırarak hatayı gizleme; auth/RLS/MFA kontrollerini gevşetme.
4. Önce ilgili regresyon kontrolünü çalıştır; gerekliyse gerçek hata davranışını doğrulayan test ekle. Sonra `npm run lint`, `npm run typecheck`, `npm test`, `npm run audit:production`, `npm run build` çalıştır; build/typecheck paralel olmasın.
5. DB değiştiyse AGENTS'taki izinli izole DB ve generated-type kontrollerini, UI/auth değiştiyse uygun Playwright/e2e kontrollerini uygula. `.github/workflows/quality.yml` ve `.github/workflows/dependency-audit.yml` kapılarını referans al; yan etkili betikleri önce incele.
6. Kök neden, değişen dosyalar, tasarım tercihi, doğrulama sonuçları ve kalan riski raporla. Atlanan/başarısız kontrolü passed gösterme; production adımlarını manuel ve ayrı tut.
