import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncGoogleCalendarForStaff } from "@/lib/google-calendar-sync";
import { errorCodeFrom, structuredLog } from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";
import { decryptCalendarToken, parseCalendarTokenEncryptionKey } from "@/lib/calendar-token-crypto";
import { revokeGoogleOAuthToken } from "@/lib/google-oauth-revocation";

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
  const admin = createSupabaseAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from("calendar_connections")
    .select("refresh_token_ciphertext")
    .eq("staff_id", staff.id)
    .eq("provider", "google")
    .maybeSingle();
  if (connectionError) {
    return NextResponse.json({ error: "Takvim bağlantısı kaldırılamadı." }, { status: 500 });
  }

  let remoteRevoked = false;
  if (connection) {
    try {
      const key = parseCalendarTokenEncryptionKey(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY);
      const refreshToken = await decryptCalendarToken(connection.refresh_token_ciphertext, key);
      remoteRevoked = await revokeGoogleOAuthToken(refreshToken);
    } catch (error) {
      structuredLog("warn", "calendar.disconnect.remote_revoke_failed", {
        actorStaffId: staff.id,
        errorCode: errorCodeFrom(error),
      });
    }
  }

  // Local encrypted credentials must be removed even if Google's revocation
  // endpoint is temporarily unavailable. The user can also revoke access from
  // Google Account settings as documented in the public privacy policy.
  const { error } = await admin
    .from("calendar_connections")
    .delete()
    .eq("staff_id", staff.id)
    .eq("provider", "google");
  if (error) return NextResponse.json({ error: "Takvim bağlantısı kaldırılamadı." }, { status: 500 });
  return NextResponse.json({ ok: true, remoteRevoked });
}
