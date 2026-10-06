import { bodySuppliesStaffId, clientSuppliedStaffId, isUuid } from "@/lib/mobile-contract";
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
  if (!isUuid(id)) return mobileJson(request, { code: "invalid_task", message: "Görev bulunamadı." }, 400);
  const body = await request.json().catch(() => null);
  if (bodySuppliesStaffId(body)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }

  try {
    const access = await requireMobileAccess(accessToken);
    const { data, error } = await access.client.rpc("set_task_status_v1", {
      p_task_id: id,
      p_status: "completed",
    });
    if (error) {
      structuredLog("error", "mobile.tasks.complete_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.tasks.complete",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "task_complete_failed", message: "Görev tamamlanamadı." }, error.code === "42501" ? 403 : 400);
    }
    if (!data) return mobileJson(request, { code: "task_not_found", message: "Görev bulunamadı veya işlem yetkiniz yok." }, 404);
    return mobileJson(request, { status: "completed" });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
