import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";
import { executeApprovedPrivacyAction } from "@/lib/privacy-lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const { data: settings, error: settingsError } = await admin
    .from("privacy_settings")
    .select("automatic_actions_enabled")
    .eq("id", "00000000-0000-0000-0000-000000000360")
    .single();
  if (settingsError) {
    return NextResponse.json({ error: "KVKK ayarları okunamadı." }, { status: 500 });
  }
  if (!settings.automatic_actions_enabled) {
    return NextResponse.json({ ok: true, status: "skipped", reason: "automatic_actions_disabled" });
  }

  const windowKey = new Date().toISOString().slice(0, 10);
  const { data: existing } = await admin
    .from("scheduled_job_runs")
    .select("status")
    .eq("job_name", "privacy")
    .eq("window_key", windowKey)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, status: "skipped", reason: "window_already_processed" });
  }
  const { data: run, error: runError } = await admin
    .from("scheduled_job_runs")
    .insert({ job_name: "privacy", window_key: windowKey })
    .select("id")
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "KVKK zamanlayıcısı başlatılamadı." }, { status: 500 });
  }

  let processed = 0;
  let failed = 0;
  const { data: actions, error: actionsError } = await admin
    .from("privacy_action_queue")
    .select("id")
    .eq("status", "approved")
    .order("approved_at")
    .limit(20);
  if (actionsError) failed += 1;
  for (const action of actions ?? []) {
    try {
      await executeApprovedPrivacyAction(action.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      const code = errorCodeFrom(error);
      await admin.from("privacy_audit_log").insert({
        action_id: action.id,
        event_type: "failed",
        reason: "Zamanlanmış KVKK işlemi güvenli kapıda durduruldu.",
        metadata: { error_code: code },
      });
      structuredLog("error", "privacy.lifecycle.action_failed", {
        requestId,
        operation: "privacy.lifecycle",
        errorCode: code,
      });
    }
  }
  await admin.from("scheduled_job_runs").update({
    status: failed > 0 ? "failed" : "succeeded",
    inserted_count: processed,
    error_code: failed > 0 ? "privacy_action_failed" : null,
    completed_at: new Date().toISOString(),
  }).eq("id", run.id);
  return NextResponse.json({
    ok: failed === 0,
    status: failed > 0 ? "failed" : "succeeded",
    processed,
    failed,
  }, { status: failed > 0 ? 500 : 200 });
}
