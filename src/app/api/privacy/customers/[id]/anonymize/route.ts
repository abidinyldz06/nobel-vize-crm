import { NextResponse } from "next/server";
import { anonymizeCustomerSchema } from "@/lib/api-input";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";
import { readValidJson } from "@/lib/request-json";
import { observedRoute } from "@/lib/observability";

async function anonymizeCustomer(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { id } = await params;
  const parsed = await readValidJson(request, anonymizeCustomerSchema);
  if (!parsed.ok) return parsed.response;
  const { error } = await supabase.rpc("anonymize_customer_v1", { p_customer_id: id, p_request_id: parsed.data.requestId });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ success: true });
}

export const POST = observedRoute("privacy.anonymize_customer", anonymizeCustomer);
