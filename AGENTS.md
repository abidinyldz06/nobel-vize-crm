<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Nobel Vize CRM — güvenli değişiklik ve teslim

- Bu bir production CRM'dir: Next.js 16 App Router, React 19 ve Supabase/Postgres. Değişiklikten önce `README.md`, ilgili `docs/` raporu/runbook'u ve mevcut implementasyonu oku; geçmiş raporları güncel kod veya canlı durum yerine kullanma.
- Auth, RLS, müşteri verisi, KVKK, audit log, ödeme, Storage, Google entegrasyonları ve production migration'ları yüksek risklidir. Auth/RLS/MFA/audit/KVKK/data retention güvenliğini zayıflatma; secret, service-role, OAuth, encryption, webhook veya `.env` değerlerini asla commit etme, çıktıya dökme.
- Küçük ve hedefli değişiklik yap; çalışan özellikleri ve UI'yi koru. Geniş refactor yapma; mevcut component, util ve dependency'leri yeniden kullan. Test, migration, safeguard veya doküman silerek kontrolleri geçirme.
- Açıkça istenmedikçe production veri/config değişikliği veya deploy yapma. Migration'ları additive ve backward-compatible tasarla; `DROP`, `TRUNCATE` ve geri alınamaz dönüşümler için tam hedef, ortam, etki, yedek/geri dönüş planı ve kullanıcı onayı gerekir.
- `git push --force` (force-with-lease dahil), history rewrite ve destructive cleanup yasaktır. Kuralları farklı argüman sırası, `git -C/-c`, alias, shell wrapper, Python/Node veya MCP ile aşma. Geri alınabilir yeni commit/`git revert` tercih et; silme yerine önce dosya listesini ve sahipliğini incele.
- DB değişikliğinde mevcut migration'ları, RLS/policy/RPC/Storage yetkilerini ve generated types'ı incele. `src/types/database.ts` yerel şemadan üretilen tiplerle senkron kalmalı; elle tip uydurma veya migration geçmişini yeniden yazma.
- Normal değişiklikte tam uygulama kapıları: `npm run lint`, `npm run typecheck`, `npm test`, `npm run audit:production`, `npm run build`. Önce package scripts/CI/betik yan etkilerini incele; build ve typecheck'i aynı checkout'ta paralel çalıştırma. Bu tam liste yukarıdaki asgari kontrolleri tamamlar.
- DB değişikliğinde ayrıca `npm run db:start`, `npm run db:reset`, generated-type karşılaştırması, `npm run db:lint`, `npm run db:test` gerekir. Reset yalnız sahipliği doğrulanmış, açıkça izin verilen silinebilir yerel test DB'sinde yapılır; ortam uygun değilse atlama nedenini raporla, paylaşılan stack'i resetleme/durdurma. `supabase/migrations/README.md` ve `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` izle.
- UI/auth akışlarında uygun Playwright/e2e senaryolarını çalıştır. `scripts/run-e2e-local.sh` yerel MFA fixture politikasını değiştirir; yalnız izole test ortamında kullan. `restore:drill` ve `release:verify` yan etkili olduğundan genel test kısayolu olarak çalıştırılmaz.
- `.github/workflows/quality.yml` uygulama/DB/browser kapıları ve `.github/workflows/dependency-audit.yml` üretim bağımlılık denetimi kaynak noktalarıdır. Çalışmayan veya atlanan kontrolleri nedenleriyle belirt; çalıştırılmamış check'i asla passed gösterme.
- Dependency upgrade'da package/lock diff'i, resmi release notes ve breaking change'leri incele. Next/React/Supabase/auth/build tooling hassastır; otomatik major upgrade veya kapsam dışı dependency değişikliği yapma.
- PR review odağı: auth/RLS, veri sızıntısı, destructive migration, secret, audit/KVKK, müşteri iş akışları ve validation/test kanıtları. Gerçek diff üzerinden dosya/satır, etki ve çözüm yönünü belirt.
- Tamamlama raporu: amaç/kök neden, değişen dosyalar, tasarım tercihleri, testler/sonuçlar, kalan riskler ve manuel production adımları. Yerel değişiklik, commit, push, PR, main merge, PR CI, main CI ve production doğrulamasını ayrı bildir; görev yalnız yerelse yayın yapılmış gibi sunma.
- Repo skills: `.agents/skills/` altında `bug-investigator`, `dependency-upgrade-review`, `database-migration-review`, `release-check`; yalnız ilgili tetikleyicide kullan. Yeni plugin/MCP eklemek için somut ihtiyaç gerekir; mevcut entegrasyonu çoğaltma.
- `.codex/config.toml`, rules ve hook dosyaları yalnız güvenilen proje katmanında yüklenir. Yeni ayarların mevcut oturumda etkinleştiğini varsayma; başlangıçta etkin ayarları kontrol et. Prefix rules tam bir shell/SQL güvenlik duvarı değildir; Full Access/oturum override'ları korumayı değiştirebilir. Hook güvenini kullanıcı `/hooks` üzerinden inceler; trust kontrolünü atlama.
