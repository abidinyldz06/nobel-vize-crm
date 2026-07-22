import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";

const ALLOWED_STATUSES = new Set([
  "profil_analizi",
  "evrak_bekleniyor",
  "randevu_bekleniyor",
  "randevu_alindi",
  "evrak_hazirlaniyor",
  "basvuru_yapildi",
  "onaylandi",
  "reddedildi",
  "itiraz",
  "kapandi",
]);

export async function POST(req: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { supabase, staff } = context;
  const performed_by = staff.full_name;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const { action, customerIds, applicationIds, value } = body as {
    action?: string;
    customerIds?: unknown;
    applicationIds?: unknown;
    value?: unknown;
  };

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: "Eksik parametreler" }, { status: 400 });
  }

  if (!customerIds.every(id => typeof id === "string")) {
    return NextResponse.json({ error: "Geçersiz müşteri kimliği" }, { status: 400 });
  }

  if (action === "archive") {
    if (staff.role !== "admin") {
      return NextResponse.json({ error: "Toplu arşivleme için yönetici yetkisi gerekiyor." }, { status: 403 });
    }
    const { error } = await supabase.rpc('archive_customers_v1', { p_customer_ids: customerIds });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } 
  else if (action === "update_status") {
    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json({ error: "Müşterilerin aktif başvurusu bulunamadı" }, { status: 400 });
    }
    if (!applicationIds.every(id => typeof id === "string") || typeof value !== "string" || !ALLOWED_STATUSES.has(value)) {
      return NextResponse.json({ error: "Geçersiz başvuru durumu" }, { status: 400 });
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
    if (staff.role !== "admin") {
      return NextResponse.json({ error: "Toplu danışman ataması için yönetici yetkisi gerekiyor." }, { status: 403 });
    }
    if (value !== null && value !== undefined && typeof value !== "string") {
      return NextResponse.json({ error: "Geçersiz danışman kimliği" }, { status: 400 });
    }
    const { error } = await supabase.from('customers').update({ assigned_staff_id: value || null }).in('id', customerIds).eq('is_deleted', false);
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
