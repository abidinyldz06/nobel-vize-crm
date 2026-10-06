import { googleStartUrlAllowed, MOBILE_GOOGLE_REDIRECT } from "@/lib/mobile-contract";
import { mobileJson } from "@/lib/mobile-http";
import { createMobilePkceClient } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabase = createMobilePkceClient(storage);
  if (!supabase || !supabaseUrl) {
    return mobileJson(request, { code: "auth_unavailable", message: "Google girişi yapılandırılmadı." }, 503);
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: MOBILE_GOOGLE_REDIRECT,
        skipBrowserRedirect: true,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    });
    const verifier = [...values.entries()].find(([key]) => key.endsWith("code-verifier"))?.[1] ?? "";
    if (error || !data.url || !verifier || !googleStartUrlAllowed(data.url, supabaseUrl)) {
      return mobileJson(request, { code: "google_unavailable", message: "Google girişi başlatılamadı." }, 503);
    }
    return mobileJson(request, { url: data.url, verifier });
  } catch (error) {
    structuredLog("error", "mobile.google.start_failed", {
      requestId: requestIdFrom(request),
      operation: "mobile.google.start",
      errorCode: errorCodeFrom(error),
    });
    return mobileJson(request, { code: "google_unavailable", message: "Google girişi başlatılamadı." }, 503);
  }
}
