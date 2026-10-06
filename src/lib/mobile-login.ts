import "server-only";

import { isUuid, mobileMfaRequired, type MobileRole } from "@/lib/mobile-contract";
import { mobileJson } from "@/lib/mobile-http";
import { createMobileBearerClient } from "@/lib/mobile-session";

export async function issueMobileAccess(request: Request, accessToken: string) {
  const client = createMobileBearerClient(accessToken);
  if (!client) return mobileJson(request, { code: "auth_unavailable", message: "Giriş güvenliği geçici olarak doğrulanamıyor." }, 503);

  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    await revokeAccessToken(accessToken);
    return mobileJson(request, { code: "invalid_credentials", message: "Google ile giriş tamamlanamadı." }, 401);
  }

  const { data: staff } = await client
    .from("staff")
    .select("id, full_name, role, is_active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!staff || !staff.is_active || (staff.role !== "admin" && staff.role !== "consultant")) {
    await revokeAccessToken(accessToken);
    return mobileJson(request, { code: "inactive_staff", message: "Aktif personel kaydı bulunamadı." }, 403);
  }

  const role = staff.role as MobileRole;
  const { data: company } = await client
    .from("tenants")
    .select("admin_mfa_required, consultant_mfa_required")
    .single();
  if (!company) {
    await revokeAccessToken(accessToken);
    return mobileJson(request, { code: "policy_unavailable", message: "Güvenlik politikası okunamadı." }, 403);
  }

  if (!mobileMfaRequired(role, company)) {
    return mobileJson(request, {
      status: "authorized",
      accessToken,
      staff: { fullName: staff.full_name, role },
    });
  }

  const verified = await verifiedFactorId(accessToken);
  if (!verified) {
    await revokeAccessToken(accessToken);
    return mobileJson(request, {
      code: "MFA_ENROLLMENT_REQUIRED",
      message: "İkinci doğrulama kaydı yok. Önce web CRM üzerinden doğrulayıcı ekleyin.",
    }, 403);
  }

  const challengeId = await createFactorChallenge(accessToken, verified);
  if (!challengeId) {
    await revokeAccessToken(accessToken);
    return mobileJson(request, { code: "mfa_unavailable", message: "İkinci doğrulama başlatılamadı." }, 403);
  }

  return mobileJson(request, {
    status: "mfa_required",
    code: "MFA_REQUIRED",
    challengeId,
    factorId: verified,
    accessToken,
  });
}

async function verifiedFactorId(accessToken: string) {
  const payload = await authGet(accessToken, "/factors");
  const totp: unknown[] = payload && typeof payload === "object" && "totp" in payload && Array.isArray(payload.totp) ? payload.totp : [];
  const verified = totp.find((factor: unknown) => {
    if (!factor || typeof factor !== "object") return false;
    const row = factor as { id?: unknown; status?: unknown };
    return row.status === "verified" && typeof row.id === "string" && isUuid(row.id);
  }) as { id: string } | undefined;
  return verified?.id ?? null;
}

async function createFactorChallenge(accessToken: string, factorId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/factors/${factorId}/challenge`, {
    method: "POST",
    headers: { apikey: anon, authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  const id = payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string" ? payload.id : "";
  return response.ok && isUuid(id) ? id : null;
}

async function authGet(accessToken: string, path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const response = await fetch(`${url}/auth/v1${path}`, {
    headers: { apikey: anon, authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function revokeAccessToken(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: anon, authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => undefined);
}
