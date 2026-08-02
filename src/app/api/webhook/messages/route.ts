import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { verifySignedWebhookWithSecret } from "@/lib/webhook-security";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type LegacyMessageWebhookPayload = {
  outbox_id?: string;
  status?: "accepted" | "delivered" | "failed";
  provider_message_id?: string;
  error_code?: string;
};

type ResendWebhookPayload = {
  type?: string;
  data?: {
    email_id?: string;
  };
};

function stableProviderEventId(value: string) {
  const hash = createHash("sha256").update(`resend:${value}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function reserveWebhookEvent(eventId: string, source: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("webhook_events").insert({
    event_id: eventId,
    source,
    status: "processing",
  });
  if (error?.code === "23505") return { admin, duplicate: true as const };
  if (error) throw error;
  return { admin, duplicate: false as const };
}

async function finishWebhookEvent(eventId: string, status: "processed" | "failed") {
  const admin = createSupabaseAdminClient();
  await admin.from("webhook_events").update({ status, processed_at: new Date().toISOString() }).eq("event_id", eventId);
}

export async function verifyResendWebhook(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return { ok: false as const, status: 503, error: "Resend webhook anahtarı yapılandırılmamış." };

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return { ok: false as const, status: 401, error: "Resend webhook imzası eksik." };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 256 * 1024) {
    return { ok: false as const, status: 413, error: "Webhook isteği çok büyük." };
  }

  try {
    const payload = new Webhook(secret).verify(rawBody, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as ResendWebhookPayload;
    return { ok: true as const, eventId: id, payload };
  } catch {
    return { ok: false as const, status: 401, error: "Resend webhook imzası doğrulanamadı." };
  }
}

function resendDeliveryStatus(eventType: string | undefined) {
  if (eventType === "email.delivered") return "delivered" as const;
  if (["email.bounced", "email.complained", "email.failed"].includes(eventType ?? "")) return "failed" as const;
  if (["email.sent", "email.queued", "email.scheduled"].includes(eventType ?? "")) return "accepted" as const;
  return null;
}

async function receiveResendWebhook(request: Request) {
  const verification = await verifyResendWebhook(request);
  if (!verification.ok) return NextResponse.json({ error: verification.error }, { status: verification.status });

  const eventId = stableProviderEventId(verification.eventId);
  let reservation: Awaited<ReturnType<typeof reserveWebhookEvent>>;
  try {
    reservation = await reserveWebhookEvent(eventId, "resend");
  } catch {
    return NextResponse.json({ error: "Webhook olayı kaydedilemedi." }, { status: 500 });
  }
  if (reservation.duplicate) return NextResponse.json({ ok: true, status: "duplicate" });

  const deliveryStatus = resendDeliveryStatus(verification.payload.type);
  const providerMessageId = verification.payload.data?.email_id;
  if (!deliveryStatus || !providerMessageId) {
    await finishWebhookEvent(eventId, "processed");
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const { data: outbox, error: outboxError } = await reservation.admin
    .from("message_outbox")
    .select("id")
    .eq("provider_name", "resend")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (outboxError) {
    await finishWebhookEvent(eventId, "failed");
    return NextResponse.json({ error: "E-posta kaydı bulunamadı." }, { status: 500 });
  }
  if (!outbox) {
    await finishWebhookEvent(eventId, "processed");
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const { data, error } = await reservation.admin.rpc("apply_message_delivery_event_v1", {
    p_outbox_id: outbox.id,
    p_status: deliveryStatus,
    p_provider_message_id: providerMessageId,
    p_error_code: deliveryStatus === "failed" ? verification.payload.type ?? "resend_failed" : undefined,
  });
  await finishWebhookEvent(eventId, error || !data ? "failed" : "processed");
  if (error || !data) return NextResponse.json({ error: "Teslim durumu uygulanamadı." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function receiveLegacyWebhook(request: Request) {
  const verification = await verifySignedWebhookWithSecret(request, process.env.MESSAGE_WEBHOOK_SECRET);
  if (!verification.ok) return NextResponse.json({ error: verification.error }, { status: verification.status });
  let payload: LegacyMessageWebhookPayload;
  try {
    payload = JSON.parse(verification.rawBody) as LegacyMessageWebhookPayload;
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

  let reservation: Awaited<ReturnType<typeof reserveWebhookEvent>>;
  try {
    reservation = await reserveWebhookEvent(verification.eventId, "message-provider");
  } catch {
    return NextResponse.json({ error: "Olay kaydedilemedi." }, { status: 500 });
  }
  if (reservation.duplicate) return NextResponse.json({ ok: true, status: "duplicate" });

  const { data, error } = await reservation.admin.rpc("apply_message_delivery_event_v1", {
    p_outbox_id: payload.outbox_id,
    p_status: payload.status,
    p_provider_message_id: payload.provider_message_id,
    p_error_code: payload.error_code,
  });
  await finishWebhookEvent(verification.eventId, error || !data ? "failed" : "processed");
  if (error || !data) return NextResponse.json({ error: "Teslim durumu uygulanamadı." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (request.headers.has("svix-id") || request.headers.has("svix-signature")) {
    return receiveResendWebhook(request);
  }
  return receiveLegacyWebhook(request);
}
