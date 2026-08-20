const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export async function revokeGoogleOAuthToken(
  token: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!token || token.length < 10) {
    throw Object.assign(new Error("google_oauth_revoke_token_invalid"), {
      code: "google_oauth_revoke_token_invalid",
    });
  }
  const response = await fetchImpl(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  return response.ok;
}
