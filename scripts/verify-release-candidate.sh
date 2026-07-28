#!/bin/sh
set -eu

cleanup() {
  npm run db:stop >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# macOS dosya senkronizasyonu bazen yeniden üretilebilir Next type cache
# dosyalarını " 2.ts" ekiyle çoğaltır ve tsc aynı bildirimi iki kez okur.
if [ -d .next/types ]; then
  find .next/types -type f -name '* 2.ts' -delete
fi

npm run quality
npm run db:start
npm run db:reset
npx supabase gen types typescript --local | sed '${/^$/d;}' > /tmp/nobel-vize-database.ts
diff -u src/types/database.ts /tmp/nobel-vize-database.ts
npm run db:lint
npm run db:test
npm run restore:drill
npm run test:e2e:local
