import "server-only";

import { portalAttemptKeys } from "@/lib/portal-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/types/database";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPortalToken(value: string) {
  return UUID_PATTERN.test(value);
}

const PORTAL_ERROR_PAD_MS = 400;

function portalAllowed(value: Json | null) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && "allowed" in value
    && value.allowed === true,
  );
}

async function padPortalError(startedAt: number) {
  const remaining = PORTAL_ERROR_PAD_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function getActivePortalCustomer(token: string, forwardedFor: string | null) {
  const startedAt = Date.now();
  const deny = async () => {
    await padPortalError(startedAt);
    return null;
  };
  const keys = portalAttemptKeys(forwardedFor, token);
  const admin = createSupabaseAdminClient();
  const gate = await admin.rpc("consume_portal_rate_limit_v1", {
    p_pair_hash: keys.pair,
    p_ip_hash: keys.ip,
    p_outcome: "check",
  });
  if (gate.error || !portalAllowed(gate.data)) return deny();

  if (!isPortalToken(token)) {
    await admin.rpc("consume_portal_rate_limit_v1", {
      p_pair_hash: keys.pair,
      p_ip_hash: keys.ip,
      p_outcome: "failure",
    });
    return deny();
  }

  const { data } = await admin
    .from("customers")
    .select("id, first_name, last_name")
    .eq("portal_token", token)
    .eq("is_deleted", false)
    .eq("portal_access_enabled", true)
    .gt("portal_token_expires_at", new Date().toISOString())
    .maybeSingle();
  const outcome = data ? "success" : "failure";
  const recorded = await admin.rpc("consume_portal_rate_limit_v1", {
    p_pair_hash: keys.pair,
    p_ip_hash: keys.ip,
    p_outcome: outcome,
  });
  if (!data || recorded.error || !portalAllowed(recorded.data)) return deny();
  return data;
}
