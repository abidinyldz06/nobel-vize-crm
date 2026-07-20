import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { data: staffList, error } = await supabase
    .from('staff')
    .select('id, full_name, email, role, phone, is_active, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: staffList?.length || 0, staff: staffList });
}
