import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { observedRoute } from "@/lib/observability";

const statuses = new Set(["scheduled", "cancelled", "no_show", "completed"]);

async function updateStatus(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let supabase;
  try {
    ({ supabase } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: string; note?: string } | null;
  if (!body?.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "Geçersiz randevu durumu." }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_appointment_status_v1", {
    p_application_id: id,
    p_status: body.status,
    p_note: body.note?.trim() || undefined,
  });
  if (error) {
    return NextResponse.json({ error: "Randevu durumu güncellenemedi.", code: error.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = observedRoute("appointments.update_status", updateStatus);
