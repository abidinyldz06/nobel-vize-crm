import { NextResponse } from "next/server";
import { checkBackupFreshness, checkReadiness } from "@/lib/health";
import {
  observedRoute,
  requestIdFrom,
  structuredLog,
} from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";

export const dynamic = "force-dynamic";

async function readiness(request: Request) {
  const result = await checkReadiness();

  if (!result.ready) {
    const requestId = requestIdFrom(request);
    structuredLog("error", "health.readiness.failed", {
      requestId,
      operation: "health.readiness",
      errorCode: result.errorCodes[0] ?? "readiness_failed",
    });
    await recordOperationalEvent({
      eventKey: "health.readiness.failed",
      severity: "critical",
      source: "health",
      requestId,
      route: "/api/health/ready",
      errorCode: result.errorCodes[0] ?? "readiness_failed",
    });
  } else {
    const freshness = await checkBackupFreshness();
    if (freshness.stale) {
      await recordOperationalEvent({
        eventKey: "backup.stale",
        severity: "warning",
        source: "backup",
        requestId: requestIdFrom(request),
        route: "/api/health/ready",
        errorCode: freshness.errorCode ?? "verified_backup_stale",
      });
    }
  }

  return NextResponse.json(
    {
      status: result.ready ? "ready" : "unavailable",
      service: "nobel-vize-crm",
      checked_at: result.checkedAt,
    },
    {
      status: result.ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export const GET = observedRoute("health.ready", readiness);
