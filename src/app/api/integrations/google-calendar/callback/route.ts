import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { encryptCalendarToken, parseCalendarTokenEncryptionKey } from "@/lib/calendar-token-crypto";
import { exchangeGoogleCalendarCode, getGoogleCalendarConfig, verifyGoogleCalendarOAuthState } from "@/lib/google-calendar-oauth";

const OAUTH_COOKIE = "nobel_google_calendar_oauth";

export const runtime = "nodejs";

function redirect(config: { appUrl: string }, outcome: string) {
  return NextResponse.redirect(new URL(`/appointments?calendar=${outcome}`, config.appUrl));
}

function equalState(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function GET(request: Request) {
  let config;
  try {
    config = getGoogleCalendarConfig();
  } catch {
    return NextResponse.json({ error: "Google Takvim bağlantısı henüz yapılandırılmadı." }, { status: 503 });
  }
  const url = new URL(request.url);
  const responseError = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map(value => value.trim()).find(value => value.startsWith(`${OAUTH_COOKIE}=`));
  const cookieState = cookie ? decodeURIComponent(cookie.slice(`${OAUTH_COOKIE}=`.length)) : "";

  if (responseError || !state || !cookieState || !equalState(state, cookieState)) {
    const response = redirect(config, "denied");
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  }
  try {
    const oauthState = verifyGoogleCalendarOAuthState(state, config);
    const code = url.searchParams.get("code") ?? "";
    const token = await exchangeGoogleCalendarCode(code, config);
    const key = parseCalendarTokenEncryptionKey(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY);
    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("calendar_connections")
      .select("refresh_token_ciphertext")
      .eq("staff_id", oauthState.staffId)
      .eq("provider", "google")
      .maybeSingle();
    if (existingError) throw existingError;
    const refreshTokenCiphertext = token.refreshToken
      ? await encryptCalendarToken(token.refreshToken, key)
      : existing?.refresh_token_ciphertext;
    if (!refreshTokenCiphertext) {
      throw Object.assign(new Error("google_calendar_refresh_token_missing"), { code: "google_calendar_refresh_token_missing" });
    }
    const { error: upsertError } = await admin.from("calendar_connections").upsert({
      staff_id: oauthState.staffId,
      provider: "google",
      calendar_id: "primary",
      access_token_ciphertext: await encryptCalendarToken(token.accessToken, key),
      refresh_token_ciphertext: refreshTokenCiphertext,
      access_token_expires_at: token.expiresAt.toISOString(),
      sync_token: null,
      sync_enabled: true,
      last_synced_at: null,
      last_sync_error: null,
    }, { onConflict: "staff_id,provider" });
    if (upsertError) throw upsertError;
    const response = redirect(config, "connected");
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch {
    const response = redirect(config, "failed");
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  }
}
