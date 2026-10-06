import { mobileJson } from "@/lib/mobile-http";
import { bearerToken } from "@/lib/mobile-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !url || !anon) {
    return mobileJson(request, { code: "logout_unverified", message: "Sunucu oturum kapatması doğrulanamadı." }, 502);
  }

  try {
    const response = await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: anon, authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return mobileJson(request, { code: "logout_unverified", message: "Sunucu oturum kapatması doğrulanamadı." }, 502);
    }
  } catch {
    return mobileJson(request, { code: "logout_unverified", message: "Sunucu oturum kapatması doğrulanamadı." }, 502);
  }

  return mobileJson(request, { status: "signed_out" });
}
