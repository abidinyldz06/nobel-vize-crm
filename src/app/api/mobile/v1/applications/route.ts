import {
  clientSuppliedStaffId,
  cursorFilter,
  decodeTaskCursor,
  encodeTaskCursor,
  mapMobileApplication,
  MOBILE_TASK_PAGE_SIZE,
} from "@/lib/mobile-contract";
import { mobileAccessResponse, mobileJson } from "@/lib/mobile-http";
import { bearerToken, requireMobileAccess } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  const url = new URL(request.url);
  if (clientSuppliedStaffId(url)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }
  const cursorText = url.searchParams.get("cursor");
  const cursor = cursorText ? decodeTaskCursor(cursorText) : null;
  if (cursorText && !cursor) return mobileJson(request, { code: "invalid_cursor", message: "Sayfa imi geçersiz." }, 400);

  try {
    const context = await requireMobileAccess(accessToken);
    let query = context.client
      .from("applications")
      .select("id, country, visa_type, status, updated_at, customers!inner(first_name, last_name, is_deleted)")
      .eq("assigned_staff_id", context.staff.id)
      .eq("customers.is_deleted", false)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MOBILE_TASK_PAGE_SIZE + 1);
    if (cursor) query = query.or(cursorFilter("updated_at", cursor, "desc"));
    const { data, error } = await query;
    if (error) {
      structuredLog("error", "mobile.applications.read_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.applications.read",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "applications_unavailable", message: "Başvurular alınamadı." }, error.code === "42501" ? 403 : 500);
    }
    const mapped = (data ?? []).flatMap((row) => {
      const application = mapMobileApplication(row);
      return application ? [{ application, updatedAt: row.updated_at }] : [];
    });
    const page = mapped.slice(0, MOBILE_TASK_PAGE_SIZE);
    const last = page.at(-1);
    const nextCursor = mapped.length > MOBILE_TASK_PAGE_SIZE && last
      ? encodeTaskCursor(last.updatedAt, last.application.id)
      : null;
    return mobileJson(request, { items: page.map((item) => item.application), nextCursor });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
