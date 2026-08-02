import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncGoogleCalendarForStaff } from "@/lib/google-calendar-sync";
import { errorCodeFrom } from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";

export const runtime = "nodejs";

export async function GET() {
  let supabase;
  try {
    ({ supabase } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { data, error } = await supabase.rpc("get_google_calendar_connection_status_v1");
  if (error || !data?.[0]) {
    return NextResponse.json({ error: "Takvim bağlantı durumu okunamadı." }, { status: 500 });
  }
  const status = data[0];
  return NextResponse.json({
    connected: status.connected,
    syncEnabled: status.sync_enabled,
    calendarId: status.calendar_id,
    lastSyncedAt: status.last_synced_at,
    lastSyncError: status.last_sync_error,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  let staff;
  try {
    ({ staff } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  try {
    const result = await syncGoogleCalendarForStaff(staff.id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const errorCode = errorCodeFrom(error);
    await recordOperationalEvent({
      eventKey: "calendar.sync.failed",
      severity: "warning",
      source: "system",
      route: "/api/integrations/google-calendar",
      errorCode,
    });
    return NextResponse.json({ error: "Takvim eşitlemesi tamamlanamadı." }, { status: 400 });
  }
}

export async function DELETE() {
  let staff;
  try {
    ({ staff } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { error } = await createSupabaseAdminClient()
    .from("calendar_connections")
    .delete()
    .eq("staff_id", staff.id)
    .eq("provider", "google");
  if (error) return NextResponse.json({ error: "Takvim bağlantısı kaldırılamadı." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
