#!/bin/sh
set -eu

status_json="$(npx supabase status -o json)"

export NEXT_PUBLIC_SUPABASE_URL="$(printf '%s' "$status_json" | jq -r '.API_URL')"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(printf '%s' "$status_json" | jq -r '.ANON_KEY')"
export SUPABASE_SERVICE_ROLE_KEY="$(printf '%s' "$status_json" | jq -r '.SERVICE_ROLE_KEY')"
export GOOGLE_FORM_WEBHOOK_SECRET="phase-2-local-e2e-secret-at-least-32-bytes"

npx playwright test "$@"
