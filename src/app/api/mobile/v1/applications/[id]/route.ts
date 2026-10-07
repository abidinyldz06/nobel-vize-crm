import { clientSuppliedStaffId, isUuid, projectApplicationDetail } from "@/lib/mobile-contract";
import { mobileAccessResponse, mobileJson } from "@/lib/mobile-http";
import { bearerToken, requireMobileAccess } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

const hidden = { code: "record_not_found", message: "Kayıt bulunamadı." };

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  const url = new URL(request.url);
  if (clientSuppliedStaffId(url)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }
  const { id } = await routeContext.params;
  if (!isUuid(id)) return mobileJson(request, hidden, 404);

  try {
    const access = await requireMobileAccess(accessToken);
    const { data, error } = await access.client
      .from("applications")
      .select("id, customer_id, country, visa_type, status, created_at, assigned_staff_id, customers!inner(first_name, last_name, is_deleted)")
      .eq("id", id)
      .eq("assigned_staff_id", access.staff.id)
      .eq("customers.is_deleted", false)
      .maybeSingle();
    if (error) {
      structuredLog("error", "mobile.applications.detail_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.applications.detail",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(
        request,
        { code: "application_unavailable", message: "Kayıt alınamadı." },
        error.code === "42501" ? 403 : 500,
      );
    }
    const detail = projectApplicationDetail(access.staff.id, data);
    if (!detail) return mobileJson(request, hidden, 404);
    return mobileJson(request, detail);
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
