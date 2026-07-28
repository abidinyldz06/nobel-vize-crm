import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { configuredMessageProvider } from "@/lib/message-provider";
import { processMessageOutbox } from "@/lib/message-outbox";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  }
  try {
    const provider = configuredMessageProvider();
    if (!provider) {
      return NextResponse.json({ ok: true, status: "skipped", reason: "provider_not_configured" });
    }
    return NextResponse.json({ ok: true, status: "processed", ...await processMessageOutbox(provider) });
  } catch (error) {
    const errorCode = errorCodeFrom(error);
    structuredLog("error", "messages.delivery.failed", {
      requestId,
      operation: "messages.delivery",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "messages.delivery.failed",
      severity: "error",
      source: "system",
      requestId,
      route: "/api/cron/messages",
      errorCode,
    });
    return NextResponse.json({ error: "Mesaj kuyruğu işlenemedi." }, { status: 500 });
  }
}
