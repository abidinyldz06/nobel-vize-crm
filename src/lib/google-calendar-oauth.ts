import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  stateSecret: string;
};

export type GoogleTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
};

type OAuthState = {
  nonce: string;
  staffId: string;
  expiresAt: number;
};

function configurationError(code: string) {
  return Object.assign(new Error(code), { code });
}

export function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const stateSecret = process.env.GOOGLE_CALENDAR_STATE_SECRET;
  if (!clientId || !clientSecret || !appUrl || !stateSecret || stateSecret.length < 32) {
    throw configurationError("google_calendar_not_configured");
  }
  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("invalid protocol");
  } catch {
    throw configurationError("google_calendar_app_url_invalid");
  }
  return { clientId, clientSecret, appUrl, stateSecret };
}

export function googleCalendarRedirectUri(config: GoogleCalendarConfig) {
  return `${config.appUrl}/api/integrations/google-calendar/callback`;
}

function stateSignature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createGoogleCalendarOAuthState(staffId: string, config: GoogleCalendarConfig) {
  const state: OAuthState = {
    nonce: randomUUID(),
    staffId,
    expiresAt: Date.now() + 10 * 60_000,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${stateSignature(payload, config.stateSecret)}`;
}

export function verifyGoogleCalendarOAuthState(value: string | undefined, config: GoogleCalendarConfig) {
  if (!value) throw configurationError("google_calendar_state_missing");
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length) throw configurationError("google_calendar_state_invalid");
  const expected = Buffer.from(stateSignature(payload, config.stateSecret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw configurationError("google_calendar_state_invalid");
  }
  let decoded: OAuthState;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  } catch {
    throw configurationError("google_calendar_state_invalid");
  }
  if (
    !/^[0-9a-f-]{36}$/i.test(decoded.staffId)
    || !/^[0-9a-f-]{36}$/i.test(decoded.nonce)
    || !Number.isFinite(decoded.expiresAt)
    || decoded.expiresAt < Date.now()
  ) {
    throw configurationError("google_calendar_state_expired");
  }
  return decoded;
}

export function googleCalendarAuthorizationUrl(state: string, config: GoogleCalendarConfig) {
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleCalendarRedirectUri(config),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

function readTokenResponse(value: unknown): GoogleTokenResponse {
  if (!value || typeof value !== "object") throw configurationError("google_calendar_token_response_invalid");
  const data = value as Record<string, unknown>;
  if (typeof data.access_token !== "string" || data.access_token.length < 10) {
    throw configurationError("google_calendar_token_response_invalid");
  }
  const expiresIn = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

async function requestToken(payload: URLSearchParams, config: GoogleCalendarConfig, fetchImpl: typeof fetch) {
  const response = await fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // status below is intentionally the only returned provider detail.
  }
  if (!response.ok) {
    throw Object.assign(new Error("google_calendar_token_exchange_failed"), {
      code: "google_calendar_token_exchange_failed",
      providerStatus: response.status,
    });
  }
  return readTokenResponse(body);
}

export async function exchangeGoogleCalendarCode(code: string, config: GoogleCalendarConfig, fetchImpl = fetch) {
  if (!code || code.length > 4096) throw configurationError("google_calendar_code_invalid");
  return requestToken(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: googleCalendarRedirectUri(config),
    grant_type: "authorization_code",
  }), config, fetchImpl);
}

export async function refreshGoogleCalendarAccessToken(refreshToken: string, config: GoogleCalendarConfig, fetchImpl = fetch) {
  if (!refreshToken || refreshToken.length < 10) throw configurationError("google_calendar_refresh_token_missing");
  return requestToken(new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  }), config, fetchImpl);
}
