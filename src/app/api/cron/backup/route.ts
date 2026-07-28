import { NextResponse } from "next/server";
import { runScheduledBackup } from "@/lib/scheduled-backup";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  }
  try {
    const result = await runScheduledBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const errorCode = errorCodeFrom(error);
    structuredLog("error", "backup.scheduled.failed", {
      requestId,
      operation: "backup.scheduled",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "backup.scheduled.failed",
      severity: "critical",
      source: "backup",
      requestId,
      route: "/api/cron/backup",
      errorCode,
    });
    return NextResponse.json({ error: "Zamanlanmış yedek tamamlanamadı." }, { status: 500 });
  }
}
