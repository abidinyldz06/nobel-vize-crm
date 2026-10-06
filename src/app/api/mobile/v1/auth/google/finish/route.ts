import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loginAttemptKey, retryAfterMessage } from "@/lib/login-security";
import { publicAuthMessage } from "@/lib/mobile-contract";
import { mobileJson } from "@/lib/mobile-http";
import { issueMobileAccess } from "@/lib/mobile-login";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let code = "";
  let verifier = "";
  try {
    const body = await request.json().catch(() => null);
    const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
    code = typeof record.code === "string" ? record.code : "";
    verifier = typeof record.verifier === "string" ? record.verifier : "";
    if (code.length < 8 || code.length > 2048 || verifier.length < 43 || verifier.length > 128) {
      return mobileJson(request, { code: "invalid_google", message: "Google ile giriş tamamlanamadı." }, 400);
    }

    let admin;
    try {
      admin = createSupabaseAdminClient();
    } catch (error) {
      structuredLog("error", "mobile.google.unavailable", {
        requestId,
        operation: "mobile.google.finish",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "auth_unavailable", message: "Giriş güvenliği geçici olarak doğrulanamıyor." }, 503);
    }

    const attemptKey = loginAttemptKey("google", request.headers.get("x-forwarded-for"));
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
        message: publicAuthMessage(retryAfterMessage(rate.retry_after_seconds ?? 900), [code, verifier]),
      }, 429);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return mobileJson(request, { code: "auth_unavailable", message: "Google girişi yapılandırılmadı." }, 503);
    }

    const response = await fetch(`${url}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: { apikey: anon, "content-type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      cache: "no-store",
    });
    code = "";
    verifier = "";
    const payload = await response.json().catch(() => null);
    const accessToken = payload && typeof payload === "object" && typeof payload.access_token === "string"
      ? payload.access_token
      : "";
    if (!response.ok || !accessToken) {
      await admin.rpc("record_login_attempt_v1", { p_key_hash: attemptKey, p_success: false });
      return mobileJson(request, { code: "invalid_credentials", message: "Google ile giriş tamamlanamadı." }, 401);
    }

    await admin.rpc("record_login_attempt_v1", { p_key_hash: attemptKey, p_success: true });
    return issueMobileAccess(request, accessToken);
  } catch (error) {
    code = "";
    verifier = "";
    structuredLog("error", "mobile.google.finish_failed", {
      requestId,
      operation: "mobile.google.finish",
      errorCode: errorCodeFrom(error),
    });
    return mobileJson(request, { code: "mobile_login_failed", message: "Giriş tamamlanamadı." }, 500);
  }
}
