import { mobileAccessResponse, mobileJson } from "@/lib/mobile-http";
import { bearerToken, requireMobileAccess } from "@/lib/mobile-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  try {
    const context = await requireMobileAccess(accessToken);
    return mobileJson(request, {
      staff: { fullName: context.staff.fullName, role: context.staff.role },
    });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
