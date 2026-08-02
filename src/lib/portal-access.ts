import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPortalToken(value: string) {
  return UUID_PATTERN.test(value);
}

export async function getActivePortalCustomer(token: string) {
  if (!isPortalToken(token)) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("portal_token", token)
    .eq("is_deleted", false)
    .eq("portal_access_enabled", true)
    .gt("portal_token_expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}
