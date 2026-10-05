import {
  clientSuppliedStaffId,
  cursorFilter,
  decodeTaskCursor,
  encodeTaskCursor,
  mapMobileAppointment,
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
      .select("id, appointment_date, appointment_location, appointment_status, country, visa_type, customers!inner(first_name, last_name, is_deleted)")
      .eq("assigned_staff_id", context.staff.id)
      .eq("customers.is_deleted", false)
      .not("appointment_date", "is", null)
      .order("appointment_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(MOBILE_TASK_PAGE_SIZE + 1);
    if (cursor) query = query.or(cursorFilter("appointment_date", cursor, "asc"));
    const { data, error } = await query;
    if (error) {
      structuredLog("error", "mobile.appointments.read_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.appointments.read",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "appointments_unavailable", message: "Randevular alınamadı." }, error.code === "42501" ? 403 : 500);
    }
    const mapped = (data ?? []).flatMap((row) => {
      const appointment = mapMobileAppointment(row);
      return appointment ? [{ appointment, startsAt: appointment.startsAt }] : [];
    });
    const page = mapped.slice(0, MOBILE_TASK_PAGE_SIZE);
    const last = page.at(-1);
    const nextCursor = mapped.length > MOBILE_TASK_PAGE_SIZE && last
      ? encodeTaskCursor(last.startsAt, last.appointment.id)
      : null;
    return mobileJson(request, { items: page.map((item) => item.appointment), nextCursor });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
