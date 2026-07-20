import "server-only";

import { verifyHmacSha256Signature } from "@/lib/webhook-signature";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const MAX_BODY_BYTES = 256 * 1024;

export async function verifySignedWebhook(request: Request) {
  const secret = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    return { ok: false as const, status: 503, error: "Webhook güvenlik anahtarı yapılandırılmamış." };
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { ok: false as const, status: 413, error: "İstek gövdesi çok büyük." };
  }

  const timestamp = request.headers.get("x-webhook-timestamp");
  const eventId = request.headers.get("x-webhook-id");
  const signatureHeader = request.headers.get("x-webhook-signature");
  const timestampSeconds = Number(timestamp);

  if (!timestamp || !Number.isInteger(timestampSeconds)) {
    return { ok: false as const, status: 401, error: "Webhook zaman damgası eksik veya geçersiz." };
  }

  if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
    return { ok: false as const, status: 401, error: "Webhook olay kimliği eksik veya geçersiz." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false as const, status: 401, error: "Webhook isteğinin süresi dolmuş." };
  }

  if (!signatureHeader) {
    return { ok: false as const, status: 401, error: "Webhook imzası eksik veya geçersiz." };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return { ok: false as const, status: 413, error: "İstek gövdesi çok büyük." };
  }

  const valid = await verifyHmacSha256Signature(secret, timestamp, eventId, rawBody, signatureHeader);

  if (!valid) {
    return { ok: false as const, status: 401, error: "Webhook imzası doğrulanamadı." };
  }

  return { ok: true as const, rawBody, eventId };
}
