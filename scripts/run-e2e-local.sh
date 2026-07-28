#!/bin/sh
set -eu

status_json="$(npx supabase status -o json)"

export NEXT_PUBLIC_SUPABASE_URL="$(printf '%s' "$status_json" | jq -r '.API_URL')"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(printf '%s' "$status_json" | jq -r '.ANON_KEY')"
export SUPABASE_SERVICE_ROLE_KEY="$(printf '%s' "$status_json" | jq -r '.SERVICE_ROLE_KEY')"
export GOOGLE_FORM_WEBHOOK_SECRET="phase-2-local-e2e-secret-at-least-32-bytes"

# Mevcut uçtan uca senaryolar tek kullanımlık admin fixture'ları oluşturur ve
# ürün akışını test eder. MFA zorlaması pgTAP/birim testlerinde ayrıca
# doğrulanır; bu yerel fixture'ların authenticator cihazı olmadığı için yalnız
# yerel veritabanında politika kapatılır. Production smoke bu betiği kullanmaz.
node --input-type=module -e '
  import { createClient } from "@supabase/supabase-js";
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client
    .from("tenants")
    .update({ admin_mfa_required: false, consultant_mfa_required: false })
    .not("id", "is", null);
  if (error) throw error;
'

npx playwright test "$@"
