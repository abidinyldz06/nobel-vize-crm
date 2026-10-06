import { applicationStatusInput, clientSuppliedStaffId, isUuid } from "@/lib/mobile-contract";
import { mobileAccessResponse, mobileJson } from "@/lib/mobile-http";
import { bearerToken, requireMobileAccess } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  const url = new URL(request.url);
  if (clientSuppliedStaffId(url)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }
  const { id } = await context.params;
  if (!isUuid(id)) return mobileJson(request, { code: "invalid_application", message: "Başvuru bulunamadı." }, 400);
  const parsed = applicationStatusInput(await request.json().catch(() => null));
  if (!parsed.ok) return mobileJson(request, { code: "invalid_status", message: parsed.message }, 400);

  try {
    const access = await requireMobileAccess(accessToken);
    const { data, error } = await access.client.rpc("update_application_status_v1", {
      p_application_id: id,
      p_status: parsed.status,
      p_rejection_reason: parsed.rejectionReason ?? undefined,
      p_action: "Mobil başvuru durumu güncellendi",
    });
    if (error || !data) {
      structuredLog("error", "mobile.applications.status_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.applications.status",
        errorCode: errorCodeFrom(error),
      });
      const status = error?.code === "42501" ? 403 : error?.code === "P0002" ? 404 : 400;
      return mobileJson(request, { code: "status_rejected", message: "Durum güncellenemedi." }, status);
    }
    return mobileJson(request, { status: parsed.status });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
