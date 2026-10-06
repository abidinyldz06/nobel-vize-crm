import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loginAttemptKey, retryAfterMessage } from "@/lib/login-security";
import { isUuid, mobileMfaRequired, publicAuthMessage, type MobileRole } from "@/lib/mobile-contract";
import { mobileJson } from "@/lib/mobile-http";
import { createMobileAuthClient } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

const FAILURE_PAD_MS = 750;

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = Date.now();
  let password = "";
  try {
    const body = await readBody(request);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
    if (!email || email.length > 320 || !password || password.length > 200) {
      return mobileJson(request, { code: "invalid_body", message: "E-posta ve parola gereklidir." }, 400);
    }

    let admin;
    try {
      admin = createSupabaseAdminClient();
    } catch (error) {
      structuredLog("error", "mobile.login.unavailable", {
        requestId,
        operation: "mobile.login",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "auth_unavailable", message: "Giriş güvenliği geçici olarak doğrulanamıyor." }, 503);
    }

    const attemptKey = loginAttemptKey(email, request.headers.get("x-forwarded-for"));
    const { data: rateLimit, error: rateLimitError } = await admin.rpc("check_login_rate_limit_v1", {
      p_key_hash: attemptKey,
    });
    if (rateLimitError) {
      return mobileJson(request, { code: "auth_unavailable", message: "Giriş güvenliği geçici olarak doğrulanamıyor." }, 503);
    }
    const rate = rateLimit as { allowed?: boolean; retry_after_seconds?: number } | null;
    if (rate?.allowed === false) {
      return mobileJson(request, {
        code: "rate_limited",
        message: publicAuthMessage(retryAfterMessage(rate.retry_after_seconds ?? 900), password),
      }, 429);
    }

    const supabase = createMobileAuthClient();
    if (!supabase) {
      return mobileJson(request, { code: "auth_unavailable", message: "Giriş güvenliği geçici olarak doğrulanamıyor." }, 503);
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    password = "";
    if (error || !authData.user || !authData.session?.access_token) {
      await admin.rpc("record_login_attempt_v1", { p_key_hash: attemptKey, p_success: false });
      await padFailure(startedAt);
      return mobileJson(request, { code: "invalid_credentials", message: "E-posta veya parola hatalı." }, 401);
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("id, full_name, role, is_active")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!staff || (staff.role !== "admin" && staff.role !== "consultant")) {
      await admin.rpc("record_login_attempt_v1", {
        p_key_hash: attemptKey,
        p_success: false,
        p_user_id: authData.user.id,
      });
      await supabase.auth.signOut();
      return mobileJson(request, { code: "inactive_staff", message: "Aktif personel kaydı bulunamadı." }, 403);
    }
    if (!staff.is_active) {
      await admin.rpc("record_login_attempt_v1", {
        p_key_hash: attemptKey,
        p_success: false,
        p_user_id: authData.user.id,
        p_staff_id: staff.id,
      });
      await supabase.auth.signOut();
      return mobileJson(request, { code: "inactive_staff", message: "Hesap pasif duruma alınmış." }, 403);
    }

    await admin.rpc("record_login_attempt_v1", {
      p_key_hash: attemptKey,
      p_success: true,
      p_user_id: authData.user.id,
      p_staff_id: staff.id,
    });

    const role = staff.role as MobileRole;
    const { data: company } = await supabase
      .from("tenants")
      .select("admin_mfa_required, consultant_mfa_required")
      .single();
    if (!company) {
      await supabase.auth.signOut();
      return mobileJson(request, { code: "policy_unavailable", message: "Güvenlik politikası okunamadı." }, 403);
    }

    if (!mobileMfaRequired(role, company)) {
      return mobileJson(request, {
        status: "authorized",
        accessToken: authData.session.access_token,
        staff: { fullName: staff.full_name, role },
      });
    }

    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp.find((factor) => factor.status === "verified" && isUuid(factor.id));
    if (factorError || !verified) {
      await supabase.auth.signOut();
      return mobileJson(request, {
        code: "MFA_ENROLLMENT_REQUIRED",
        message: "İkinci doğrulama kaydı yok. Önce web CRM üzerinden doğrulayıcı ekleyin.",
      }, 403);
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verified.id });
    if (challengeError || !challenge?.id) {
      await supabase.auth.signOut();
      return mobileJson(request, { code: "mfa_unavailable", message: "İkinci doğrulama başlatılamadı." }, 403);
    }

    return mobileJson(request, {
      status: "mfa_required",
      code: "MFA_REQUIRED",
      challengeId: challenge.id,
      factorId: verified.id,
      accessToken: authData.session.access_token,
    });
  } catch (error) {
    password = "";
    structuredLog("error", "mobile.login.failed", {
      requestId,
      operation: "mobile.login",
      errorCode: errorCodeFrom(error),
    });
    return mobileJson(request, { code: "mobile_login_failed", message: "Giriş tamamlanamadı." }, 500);
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function padFailure(startedAt: number) {
  const remaining = FAILURE_PAD_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
