import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: staffList, error } = await supabase.from('staff').select('*').order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message });
  }

  return NextResponse.json({ success: true, count: staffList?.length || 0, staff: staffList });
}
