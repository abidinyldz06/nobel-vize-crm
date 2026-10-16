import { NextResponse } from "next/server";
import { appointmentStatusSchema } from "@/lib/api-input";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { readValidJson } from "@/lib/request-json";
import { observedRoute } from "@/lib/observability";

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
  const parsed = await readValidJson(request, appointmentStatusSchema);
  if (!parsed.ok) return parsed.response;

  const { error } = await supabase.rpc("set_appointment_status_v1", {
    p_application_id: id,
    p_status: parsed.data.status,
    p_note: parsed.data.note?.trim() || undefined,
  });
  if (error) {
    return NextResponse.json({ error: "Randevu durumu güncellenemedi.", code: error.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = observedRoute("appointments.update_status", updateStatus);
