import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  assuranceFromAccessToken,
  mobileMfaRequired,
  type MobileRole,
  type MobileStaffDto,
} from "@/lib/mobile-contract";
import type { Database } from "@/types/database";

export class MobileAccessError extends Error {
  readonly status: 401 | 403;
  readonly code: string;

  constructor(status: 401 | 403, code: string, message: string) {
    super(message);
    this.name = "MobileAccessError";
    this.status = status;
    this.code = code;
  }
}

export type MobileContext = {
  client: SupabaseClient<Database>;
  staff: MobileStaffDto & { id: string };
  userId: string;
};

function authEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url, anon };
}

export function createMobileAuthClient() {
  const env = authEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createMobileBearerClient(accessToken: string) {
  const env = authEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function requireMobileAccess(accessToken: string): Promise<MobileContext> {
  const client = createMobileBearerClient(accessToken);
  if (!client) throw new MobileAccessError(403, "auth_unavailable", "Mobil oturum doğrulanamadı.");

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new MobileAccessError(401, "invalid_token", "Oturum geçersiz.");

  const { data: staff, error: staffError } = await client
    .from("staff")
    .select("id, full_name, role, is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (staffError || !staff || !staff.is_active) {
    throw new MobileAccessError(403, "inactive_staff", "Aktif personel kaydı bulunamadı.");
  }
  if (staff.role !== "admin" && staff.role !== "consultant") {
    throw new MobileAccessError(403, "invalid_role", "Geçersiz personel rolü.");
  }

  const { data: company, error: companyError } = await client
    .from("tenants")
    .select("admin_mfa_required, consultant_mfa_required")
    .single();
  if (companyError || !company) {
    throw new MobileAccessError(403, "policy_unavailable", "Güvenlik politikası okunamadı.");
  }

  const role = staff.role as MobileRole;
  if (mobileMfaRequired(role, company) && assuranceFromAccessToken(accessToken) !== "aal2") {
    throw new MobileAccessError(403, "MFA_REQUIRED", "İkinci doğrulama adımı gerekiyor.");
  }

  return {
    client,
    userId: data.user.id,
    staff: { id: staff.id, fullName: staff.full_name, role },
  };
}
