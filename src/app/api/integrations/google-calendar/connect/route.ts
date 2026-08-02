import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { createGoogleCalendarOAuthState, getGoogleCalendarConfig, googleCalendarAuthorizationUrl } from "@/lib/google-calendar-oauth";

const OAUTH_COOKIE = "nobel_google_calendar_oauth";

export const runtime = "nodejs";

export async function GET() {
  let staff;
  try {
    ({ staff } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  try {
    const config = getGoogleCalendarConfig();
    const state = createGoogleCalendarOAuthState(staff.id, config);
    const response = NextResponse.redirect(googleCalendarAuthorizationUrl(state, config));
    response.cookies.set(OAUTH_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/api/integrations/google-calendar",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Google Takvim bağlantısı henüz yapılandırılmadı." }, { status: 503 });
  }
}
