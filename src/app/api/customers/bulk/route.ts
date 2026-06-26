import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let performed_by = "Sistem";
  if (user) {
    const { data: staff } = await supabase.from('staff').select('first_name, last_name').eq('user_id', user.id).single();
    if (staff) performed_by = `${staff.first_name} ${staff.last_name}`;
  }

  const { action, customerIds, applicationIds, value } = await req.json();

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: "Eksik parametreler" }, { status: 400 });
  }

  if (action === "delete") {
    // Supabase cascade ayarlıysa application ve documentler silinir.
    const { error } = await supabase.from('customers').delete().in('id', customerIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } 
  else if (action === "update_status") {
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json({ error: "Müşterilerin aktif başvurusu bulunamadı" }, { status: 400 });
    }
    const { error } = await supabase.from('applications').update({ status: value }).in('id', applicationIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Activity log
    const logs = customerIds.map(cId => ({
      action: `Durum toplu olarak güncellendi: ${value}`,
      type: 'status',
      customer_id: cId,
      performed_by
    }));
    await supabase.from('activity_log').insert(logs);
  }
  else if (action === "assign_staff") {
    const { error } = await supabase.from('customers').update({ assigned_staff_id: value || null }).in('id', customerIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Activity log
    const logs = customerIds.map(cId => ({
      action: `Danışman toplu olarak atandı`,
      type: 'customer',
      customer_id: cId,
      performed_by
    }));
    await supabase.from('activity_log').insert(logs);
  }
  else {
    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
