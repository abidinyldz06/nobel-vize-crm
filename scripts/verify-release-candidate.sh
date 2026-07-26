#!/bin/sh
set -eu

cleanup() {
  npm run db:stop >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

npm run quality
npm run db:start
npm run db:reset
npx supabase gen types typescript --local | sed '${/^$/d;}' > /tmp/nobel-vize-database.ts
diff -u src/types/database.ts /tmp/nobel-vize-database.ts
npm run db:lint
npm run db:test
npm run restore:drill
npm run test:e2e:local
