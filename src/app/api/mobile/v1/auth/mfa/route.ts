import { isUuid, publicAuthMessage } from "@/lib/mobile-contract";
import { mobileAccessResponse, mobileJson } from "@/lib/mobile-http";
import { bearerToken, requireMobileAccess } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const pendingToken = bearerToken(request);
  if (!pendingToken) return mobileJson(request, { code: "missing_token", message: "Oturum doğrulaması gerekli." }, 401);

  let code = "";
  try {
    const body = await readBody(request);
    const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
    const factorId = typeof body?.factorId === "string" ? body.factorId : "";
    code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!isUuid(challengeId) || !isUuid(factorId) || !/^\d{6}$/.test(code)) {
      return mobileJson(request, { code: "invalid_mfa", message: "Kod 6 haneli olmalı." }, 400);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return mobileJson(request, { code: "auth_unavailable", message: "İkinci doğrulama tamamlanamadı." }, 503);
    }

    const response = await fetch(`${url}/auth/v1/factors/${factorId}/verify`, {
      method: "POST",
      headers: {
        apikey: anon,
        authorization: `Bearer ${pendingToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ challenge_id: challengeId, code }),
      cache: "no-store",
    });
    code = "";
    const payload = await readJson(response);
    const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
    if (!response.ok || !accessToken) {
      return mobileJson(request, {
        code: "invalid_mfa",
        message: publicAuthMessage("Kod doğrulanamadı.", ""),
      }, 401);
    }

    const context = await requireMobileAccess(accessToken);
    return mobileJson(request, {
      status: "authorized",
      accessToken,
      staff: { fullName: context.staff.fullName, role: context.staff.role },
    });
  } catch (error) {
    code = "";
    if (error instanceof Error && error.name === "MobileAccessError") return mobileAccessResponse(request, error);
    structuredLog("error", "mobile.mfa.failed", {
      requestId,
      operation: "mobile.mfa",
      errorCode: errorCodeFrom(error),
    });
    return mobileJson(request, { code: "mobile_mfa_failed", message: "İkinci doğrulama tamamlanamadı." }, 500);
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

async function readJson(response: Response): Promise<{ access_token?: unknown } | null> {
  try {
    return await response.json() as { access_token?: unknown };
  } catch {
    return null;
  }
}
