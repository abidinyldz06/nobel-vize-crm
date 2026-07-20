import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function buildAdminClient(url: string, serviceRoleKey: string) {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let adminClient: ReturnType<typeof buildAdminClient> | null = null;

export function createSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY sunucu ortamında tanımlanmalıdır.",
    );
  }

  adminClient = buildAdminClient(url, serviceRoleKey);

  return adminClient;
}
