import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncAllGoogleCalendars } from "@/lib/google-calendar-sync";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  }
  const requestId = requestIdFrom(request);
  try {
    const result = await syncAllGoogleCalendars();
    if (result.failures.length) {
      throw Object.assign(new Error("calendar_connections_failed"), { code: "calendar_connections_failed" });
    }
    return NextResponse.json({ ok: true, synced: result.results.length });
  } catch (error) {
    const errorCode = errorCodeFrom(error);
    structuredLog("error", "cron.calendar.failed", {
      requestId,
      route: "/api/cron/calendar",
      operation: "cron.calendar",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "cron.calendar.failed",
      severity: "warning",
      source: "system",
      requestId,
      route: "/api/cron/calendar",
      errorCode,
    });
    return NextResponse.json({ error: "Takvim eşitlemesi tamamlanamadı." }, { status: 500 });
  }
}
