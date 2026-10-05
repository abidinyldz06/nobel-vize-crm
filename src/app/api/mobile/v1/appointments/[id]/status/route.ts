import { appointmentStatusInput, clientSuppliedStaffId, isUuid } from "@/lib/mobile-contract";
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
  if (!isUuid(id)) return mobileJson(request, { code: "invalid_appointment", message: "Randevu bulunamadı." }, 400);
  const parsed = appointmentStatusInput(await request.json().catch(() => null));
  if (!parsed.ok) return mobileJson(request, { code: "invalid_status", message: parsed.message }, 400);

  try {
    const access = await requireMobileAccess(accessToken);
    const { data, error } = await access.client.rpc("set_appointment_status_v1", {
      p_application_id: id,
      p_status: parsed.status,
      p_note: parsed.note ?? undefined,
    });
    if (error || !data) {
      structuredLog("error", "mobile.appointments.status_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.appointments.status",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "status_rejected", message: "Randevu güncellenemedi." }, error?.code === "42501" ? 403 : 400);
    }
    return mobileJson(request, { status: parsed.status });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
