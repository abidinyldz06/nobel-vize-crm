import {
  clientSuppliedStaffId,
  cursorFilter,
  decodeTaskCursor,
  encodeTaskCursor,
  isUuid,
  MOBILE_TASK_PAGE_SIZE,
  projectCustomerDetail,
} from "@/lib/mobile-contract";
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
  const cursorText = url.searchParams.get("cursor");
  const cursor = cursorText ? decodeTaskCursor(cursorText) : null;
  if (cursorText && !cursor) return mobileJson(request, { code: "invalid_cursor", message: "Sayfa imi geçersiz." }, 400);

  try {
    const access = await requireMobileAccess(accessToken);
    const customerQuery = await access.client
      .from("customers")
      .select("id, first_name, last_name, created_at, assigned_staff_id, is_deleted")
      .eq("id", id)
      .eq("assigned_staff_id", access.staff.id)
      .eq("is_deleted", false)
      .maybeSingle();
    if (customerQuery.error) return unavailable(request, customerQuery.error);
    let applicationsQuery = access.client
      .from("applications")
      .select("id, customer_id, country, visa_type, status, created_at, assigned_staff_id")
      .eq("customer_id", id)
      .eq("assigned_staff_id", access.staff.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MOBILE_TASK_PAGE_SIZE + 1);
    if (cursor) applicationsQuery = applicationsQuery.or(cursorFilter("created_at", cursor, "desc"));
    const applicationsResult = await applicationsQuery;
    if (applicationsResult.error) return unavailable(request, applicationsResult.error);
    const rows = applicationsResult.data ?? [];
    const detail = projectCustomerDetail(access.staff.id, customerQuery.data, rows.slice(0, MOBILE_TASK_PAGE_SIZE));
    if (!detail) return mobileJson(request, hidden, 404);
    const last = detail.applications.at(-1);
    const nextCursor = rows.length > MOBILE_TASK_PAGE_SIZE && last
      ? encodeTaskCursor(last.registeredAt, last.id)
      : null;
    return mobileJson(request, { ...detail, nextCursor });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}

function unavailable(request: Request, error: unknown) {
  structuredLog("error", "mobile.customers.detail_failed", {
    requestId: requestIdFrom(request),
    operation: "mobile.customers.detail",
    errorCode: errorCodeFrom(error),
  });
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  return mobileJson(
    request,
    { code: "customer_unavailable", message: "Kayıt alınamadı." },
    code === "42501" ? 403 : 500,
  );
}
