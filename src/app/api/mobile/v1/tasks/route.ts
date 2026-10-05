import {
  clientSuppliedStaffId,
  cursorFilter,
  decodeTaskCursor,
  encodeTaskCursor,
  isUuid,
  mapMobileTask,
  MOBILE_TASK_PAGE_SIZE,
  taskCreateInput,
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
  if (cursorText && !cursor) {
    return mobileJson(request, { code: "invalid_cursor", message: "Sayfa imi geçersiz." }, 400);
  }

  try {
    const context = await requireMobileAccess(accessToken);
    let query = context.client
      .from("tasks")
      .select("id, title, description, due_at, priority, status")
      .eq("assigned_staff_id", context.staff.id)
      .neq("status", "cancelled")
      .order("due_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(MOBILE_TASK_PAGE_SIZE + 1);
    if (cursor) query = query.or(cursorFilter("due_at", cursor, "asc"));

    const { data, error } = await query;
    if (error) {
      structuredLog("error", "mobile.tasks.read_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.tasks.read",
        errorCode: errorCodeFrom(error),
      });
      const status = error.code === "42501" ? 403 : 500;
      return mobileJson(request, { code: "tasks_unavailable", message: "Görevler alınamadı." }, status);
    }

    const mapped = (data ?? []).flatMap((row) => {
      const task = mapMobileTask(row);
      return task ? [task] : [];
    });
    const page = mapped.slice(0, MOBILE_TASK_PAGE_SIZE);
    const last = page.at(-1);
    const nextCursor = mapped.length > MOBILE_TASK_PAGE_SIZE && last
      ? encodeTaskCursor(last.dueAt, last.id)
      : null;
    return mobileJson(request, { items: page, nextCursor });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return mobileJson(request, { code: "missing_token", message: "Oturum açmanız gerekiyor." }, 401);
  const url = new URL(request.url);
  if (clientSuppliedStaffId(url)) {
    return mobileJson(request, { code: "staff_id_rejected", message: "Personel kimliği istemciden alınmaz." }, 400);
  }
  const parsed = taskCreateInput(await request.json().catch(() => null));
  if (!parsed.ok) return mobileJson(request, { code: "invalid_task", message: parsed.message }, 400);

  try {
    const context = await requireMobileAccess(accessToken);
    const { data, error } = await context.client.rpc("create_task_v1", { p_payload: parsed.payload });
    if (error || typeof data !== "string" || !isUuid(data)) {
      structuredLog("error", "mobile.tasks.create_failed", {
        requestId: requestIdFrom(request),
        operation: "mobile.tasks.create",
        errorCode: errorCodeFrom(error),
      });
      return mobileJson(request, { code: "task_create_failed", message: "Görev oluşturulamadı." }, error?.code === "42501" ? 403 : 400);
    }
    return mobileJson(request, { id: data });
  } catch (error) {
    return mobileAccessResponse(request, error);
  }
}
