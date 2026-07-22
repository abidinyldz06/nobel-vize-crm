import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { id } = await params;
  const body = await request.json().catch(() => null) as { requestId?: string } | null;
  if (!body?.requestId) return NextResponse.json({ error: "Onaylanmış talep kimliği zorunludur." }, { status: 400 });
  const { error } = await supabase.rpc("anonymize_customer_v1", { p_customer_id: id, p_request_id: body.requestId });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ success: true });
}
