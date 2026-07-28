import { NextResponse } from "next/server";
import { verifySignedWebhookWithSecret } from "@/lib/webhook-security";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type MessageWebhookPayload = {
  outbox_id?: string;
  status?: "accepted" | "delivered" | "failed";
  provider_message_id?: string;
  error_code?: string;
};

export async function POST(request: Request) {
  const verification = await verifySignedWebhookWithSecret(
    request,
    process.env.MESSAGE_WEBHOOK_SECRET,
  );
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  let payload: MessageWebhookPayload;
  try {
    payload = JSON.parse(verification.rawBody) as MessageWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  if (
    !payload.outbox_id
    || !/^[0-9a-f-]{36}$/i.test(payload.outbox_id)
    || !payload.status
    || !["accepted", "delivered", "failed"].includes(payload.status)
  ) {
    return NextResponse.json({ error: "Geçersiz teslim olayı." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error: replayError } = await admin.from("webhook_events").insert({
    event_id: verification.eventId,
    source: "message-provider",
    status: "processing",
  });
  if (replayError?.code === "23505") {
    return NextResponse.json({ error: "Olay daha önce işlendi." }, { status: 409 });
  }
  if (replayError) return NextResponse.json({ error: "Olay kaydedilemedi." }, { status: 500 });

  const { data, error } = await admin.rpc("apply_message_delivery_event_v1", {
    p_outbox_id: payload.outbox_id,
    p_status: payload.status,
    p_provider_message_id: payload.provider_message_id,
    p_error_code: payload.error_code,
  });
  await admin.from("webhook_events").update({
    status: error || !data ? "failed" : "processed",
    processed_at: new Date().toISOString(),
  }).eq("event_id", verification.eventId);
  if (error || !data) return NextResponse.json({ error: "Teslim durumu uygulanamadı." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
