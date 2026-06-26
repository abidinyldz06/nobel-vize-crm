import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  
  const { data: notifications, error } = await supabase
    .from('activity_log')
    .select('id, action, type, performed_by, created_at, application_id, customer_id, is_read')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(notifications);
}

export async function PATCH() {
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('activity_log')
    .update({ is_read: true })
    .eq('is_read', false);
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
