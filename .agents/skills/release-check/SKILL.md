---
name: release-check
description: Nobel Vize CRM için release adayı veya deploy readiness istendiğinde mevcut kalite kapıları, diff ve kalan riskleri doğrula. Production deploy, merge veya migration uygulama yapma.
---

# Release hazırlık kontrolü

1. `AGENTS.md`, `README.md`, ilgili runbook, package scripts, `.github/workflows/quality.yml` ve `.github/workflows/dependency-audit.yml` oku. Gerçek repo/dal/HEAD'i, çalışma ağacını ve release base/head diff'ini belirle; kullanıcı değişikliklerini koru.
2. Diff'te secret/.env/service-role/OAuth/encryption/webhook sızıntısı, migration sırası, generated types, auth/RLS/audit/KVKK etkisi, çözülmemiş TODO ve müşteri akışı risklerini incele. Secret değerlerini rapora kopyalama. `git diff --check` ve staged diff'i de kontrol et.
3. Yan etkileri inceledikten sonra sırayla `npm run lint`, `npm run typecheck`, `npm test`, `npm run audit:production`, `npm run build` çalıştır. Test/güvenlik kapısı kaldırma veya bağımlılık yükseltme bu kontrolün parçası değildir.
4. DB migration/RLS/type değiştiyse sahipliği doğrulanmış ve reset izni olan izole yerel ortamda `db:start`, `db:reset`, CI'daki generated-type karşılaştırması, `db:lint`, `db:test` gerekir. UI/auth değiştiyse uygun Playwright/e2e; recovery değiştiyse izinli izole restore tatbikatı gerekir. `release:verify`, `restore:drill` ve `test:e2e:local` reset/stop/MFA-fixture yan etkileri yüzünden körlemesine çalıştırılmaz.
5. Her kapıyı geçti/başarısız/atlanmış ve gerekçesiyle raporla; eski CI sonucunu güncel HEAD kanıtı sayma. Eksik zorunlu kapı varsa deploy'a hazır deme. Yerel sonuçlar production/MFA canlı kabul kanıtı değildir.
6. Readiness raporunu amaç/kök neden, tam değişen dosyalar, tasarım tercihleri, test sonuçları, kalan riskler ve manuel staging/production adımlarıyla bitir. Yerel commit, remote push, PR, main merge, PR CI, main CI ve production doğrulamasını ayrı göster. Bu skill deploy, push, merge veya production migration yapmaz.
