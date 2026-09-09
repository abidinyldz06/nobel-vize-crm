---
name: database-migration-review
description: Nobel Vize CRM şema, migration, RLS/RPC/Storage policy veya generated database types değişikliklerini veri kaybı ve erişim riski için incele. Production migration uygulama yetkisi vermez.
---

# Migration incelemesi

1. `AGENTS.md`, `supabase/migrations/README.md`, `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`, ilgili faz runbook'u ve mevcut uygulama sorgularını oku. Gerçek migration/RLS diff'ini ve `src/types/database.ts` etkisini incele; geçmiş migration'ları yeniden yazma.
2. `DROP`, `TRUNCATE`, geniş `DELETE`, kolon/tip dönüşümü, NOT NULL/unique constraint, backfill ve lock risklerini ara. RLS'nin kapanması, geniş grant, SECURITY DEFINER/search_path, anonim/inactive/yanlış rol erişimi, Storage görünürlüğü, audit/KVKK/data retention etkilerini denetle.
3. Additive/backward-compatible tasarımı, eski/yeni uygulama sürümü uyumunu ve forward-fix planını tercih et. Geri alınamaz işlem için tam hedef/ortam/etki ile doğrulanmış yedek ve geri dönüş planını belirle; açık kullanıcı onayı olmadan uygulama. Yalnız review istendiyse dosya değiştirme.
4. Paket betiklerini ve yerel stack sahipliğini kontrol et. Sadece izinli, silinebilir izole test DB'sinde sırayla `npm run db:start`, `npm run db:reset`, `npm run db:lint`, `npm run db:test` çalıştır. Docker yoksa veya DB paylaşılıyorsa reset/stop yapma; eksik kanıtı bildir. Betik/CLI/MCP ile onay sınırını aşma.
5. `.github/workflows/quality.yml` yöntemini izleyerek `supabase gen types typescript --local` çıktısını geçici dosyaya al ve `src/types/database.ts` ile karşılaştır. Uygulama istenmişse tipleri yerel şemadan üret; elle uydurma. İlgili pgTAP yetki/ret testlerini ve uygulama kapılarını (`lint`, `typecheck`, `test`, `audit:production`, `build`) çalıştır; UI/auth etkisinde uygun e2e ekle.
6. Bulguları dosya/satır, etki, çözüm ve test kanıtıyla raporla. `supabase db push`, remote reset/restore veya production apply otomatik yapılmaz; staging/production uygulaması ayrı yetki ve manuel kontrol adımı olarak kalır. Migration/test/safeguard silerek check geçirme.
