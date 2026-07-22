import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { APPLICATION_STATUS_META, isApplicationStatus } from "@/lib/application-status";

export async function PATCH(request: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz başvuru güncellemesi." }, { status: 400 });
  }

  const { applicationId, status, rejectionReason } = body as Record<string, unknown>;
  if (typeof applicationId !== "string" || typeof status !== "string" || !isApplicationStatus(status)) {
    return NextResponse.json({ error: "Geçersiz başvuru veya durum." }, { status: 400 });
  }
  if (status === "reddedildi" && (typeof rejectionReason !== "string" || rejectionReason.trim().length === 0)) {
    return NextResponse.json({ error: "Ret sebebi gereklidir." }, { status: 400 });
  }
  if (typeof rejectionReason === "string" && rejectionReason.length > 2000) {
    return NextResponse.json({ error: "Ret sebebi en fazla 2000 karakter olabilir." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("update_application_status_v1", {
    p_application_id: applicationId,
    p_status: status,
    p_rejection_reason: typeof rejectionReason === "string" ? rejectionReason.trim() : undefined,
    p_action: `Başvuru durumu güncellendi: ${APPLICATION_STATUS_META[status].label}`,
  });

  if (error) {
    const responseStatus = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status: responseStatus });
  }

  return NextResponse.json({ application: data });
}
