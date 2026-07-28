import { NextResponse } from "next/server";
import { isAuthorizedCronRequest, scheduledWindowKey } from "@/lib/cron-auth";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  }

  try {
    const { data, error } = await createSupabaseAdminClient().rpc(
      "run_scheduled_operations_v1",
      { p_window_key: scheduledWindowKey() },
    );
    if (error) throw error;
    const result = data as {
      status?: string;
      error_code?: string;
      inserted_count?: number;
    } | null;
    if (result?.status === "failed") {
      throw Object.assign(new Error("scheduled_operations_failed"), {
        code: result.error_code ?? "scheduled_operations_failed",
      });
    }
    let leadInsertedCount = 0;
    if (result?.status !== "skipped") {
      const { data: leadResult, error: leadError } = await createSupabaseAdminClient()
        .rpc("sync_lead_followup_tasks_v1");
      if (leadError) throw leadError;
      leadInsertedCount = leadResult ?? 0;
    }
    return NextResponse.json({
      ok: true,
      status: result?.status ?? "succeeded",
      inserted_count: (result?.inserted_count ?? 0) + leadInsertedCount,
    });
  } catch (error) {
    const errorCode = errorCodeFrom(error);
    structuredLog("error", "cron.operations.failed", {
      requestId,
      operation: "cron.operations",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "cron.operations.failed",
      severity: "error",
      source: "system",
      requestId,
      route: "/api/cron/operations",
      errorCode,
    });
    return NextResponse.json({ error: "Zamanlanmış operasyon tamamlanamadı." }, { status: 500 });
  }
}
