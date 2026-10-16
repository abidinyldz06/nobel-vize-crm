import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { applicationStatusSchema } from "@/lib/api-input";
import { APPLICATION_STATUS_META } from "@/lib/application-status";
import { readValidJson } from "@/lib/request-json";
import { observedRoute } from "@/lib/observability";

async function updateApplicationStatus(request: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const parsed = await readValidJson(request, applicationStatusSchema);
  if (!parsed.ok) return parsed.response;
  const { applicationId, status, rejectionReason } = parsed.data;

  const { data, error } = await context.supabase.rpc("update_application_status_v1", {
    p_application_id: applicationId,
    p_status: status,
    p_rejection_reason: rejectionReason?.trim() || undefined,
    p_action: `Başvuru durumu güncellendi: ${APPLICATION_STATUS_META[status].label}`,
  });

  if (error) {
    const responseStatus = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status: responseStatus });
  }

  return NextResponse.json({ application: data });
}

export const PATCH = observedRoute("applications.update_status", updateApplicationStatus);
