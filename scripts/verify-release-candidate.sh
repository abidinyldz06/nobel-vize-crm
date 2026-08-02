#!/bin/sh
set -eu

cleanup() {
  npm run db:stop >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# macOS dosya senkronizasyonu bazen yeniden üretilebilir Next type cache
# dosyalarını " 2.ts", " 3.ts" vb. eklerle çoğaltır; tsc bunları aynı
# bildirim olarak iki kez okur.
if [ -d .next/types ]; then
  find .next/types -type f -name '* [0-9]*.ts' -delete
fi

npm run quality
npm run db:start
npm run db:reset
LATEST_MIGRATION="$(find supabase/migrations -maxdepth 1 -type f -name '[0-9]*_*.sql' -exec basename {} \; | sort | tail -n 1 | cut -d_ -f1)"
attempt=0
while [ "$attempt" -lt 30 ]; do
  if npx supabase migration list --local | grep -F \
    "\"local\":\"$LATEST_MIGRATION\",\"remote\":\"$LATEST_MIGRATION\"" >/dev/null; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
if [ "$attempt" -eq 30 ]; then
  echo "Local migration reset did not finish."
  exit 1
fi
LOCAL_DB_URL="$(npx supabase status -o json | jq -r '.DB_URL')"
npx supabase gen types typescript --db-url "$LOCAL_DB_URL" | sed '${/^$/d;}' > /tmp/nobel-vize-database.ts
diff -u src/types/database.ts /tmp/nobel-vize-database.ts
npm run db:lint
npm run db:test
npm run restore:drill
npm run test:e2e:local
