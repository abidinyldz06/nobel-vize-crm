import {
  clientSuppliedStaffId,
  cursorFilter,
  decodeTaskCursor,
  encodeTaskCursor,
  isUuid,
  mapMobileNote,
  MOBILE_TASK_PAGE_SIZE,
  noteCreateInput,
} from "@/lib/mobile-contract";
import { mobileAccessResponse, mobileJson } from "@/lib/mobile-http";
import { bearerToken, requireMobileAccess, type MobileContext } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  const url = new URL(request.url);
  if (clientSuppliedStaffId(url)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }
  const { id } = await routeContext.params;
  if (!isUuid(id)) return mobileJson(request, { code: "invalid_application", message: "Başvuru bulunamadı." }, 400);
  const cursorText = url.searchParams.get("cursor");
  const cursor = cursorText ? decodeTaskCursor(cursorText) : null;
  if (cursorText && !cursor) return mobileJson(request, { code: "invalid_cursor", message: "Sayfa imi geçersiz." }, 400);

  try {
    const access = await requireMobileAccess(accessToken);
    const assigned = await assignedApplication(access, id);
    if (assigned.error) return unavailable(request, assigned.error);
    if (!assigned.data) return mobileJson(request, { code: "application_not_found", message: "Başvuru bulunamadı." }, 404);

    let query = access.client
      .from("notes")
      .select("id, content, author, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MOBILE_TASK_PAGE_SIZE + 1);
    if (cursor) query = query.or(cursorFilter("created_at", cursor, "desc"));
    const { data, error } = await query;
    if (error) return unavailable(request, error);
    const mapped = (data ?? []).flatMap((row) => {
      const note = mapMobileNote(row);
      return note ? [note] : [];
    });
    const page = mapped.slice(0, MOBILE_TASK_PAGE_SIZE);
    const last = page.at(-1);
    const nextCursor = mapped.length > MOBILE_TASK_PAGE_SIZE && last
      ? encodeTaskCursor(last.createdAt, last.id)
      : null;
    return mobileJson(request, { items: page, nextCursor });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  const url = new URL(request.url);
  if (clientSuppliedStaffId(url)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }
  const { id } = await routeContext.params;
  if (!isUuid(id)) return mobileJson(request, { code: "invalid_application", message: "Başvuru bulunamadı." }, 400);
  const parsed = noteCreateInput(await request.json().catch(() => null));
  if (!parsed.ok) return mobileJson(request, { code: "invalid_note", message: parsed.message }, 400);

  try {
    const access = await requireMobileAccess(accessToken);
    const assigned = await assignedApplication(access, id);
    if (assigned.error) return unavailable(request, assigned.error);
    if (!assigned.data) return mobileJson(request, { code: "application_not_found", message: "Başvuru bulunamadı." }, 404);

    const { data, error } = await access.client
      .from("notes")
      .insert({
        application_id: id,
        content: parsed.content,
        author: access.staff.fullName.slice(0, 120) || "Personel",
        created_by: access.staff.id,
      })
      .select("id")
      .single();
    if (error || !data || !isUuid(data.id)) {
      structuredLog("error", "mobile.notes.write_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.notes.write",
        errorCode: errorCodeFrom(error),
      });
      const status = error?.code === "42501" ? 403 : 400;
      return mobileJson(request, { code: "note_rejected", message: "Not yazılamadı." }, status);
    }
    return mobileJson(request, { id: data.id });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}

async function assignedApplication(access: MobileContext, id: string) {
  return access.client
    .from("applications")
    .select("id")
    .eq("id", id)
    .eq("assigned_staff_id", access.staff.id)
    .maybeSingle();
}

function unavailable(request: Request, error: unknown) {
  structuredLog("error", "mobile.notes.read_failed", {
    requestId: requestIdFrom(request),
    operation: "mobile.notes.read",
    errorCode: errorCodeFrom(error),
  });
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  return mobileJson(
    request,
    { code: "notes_unavailable", message: "Notlar alınamadı." },
    code === "42501" ? 403 : 500,
  );
}
