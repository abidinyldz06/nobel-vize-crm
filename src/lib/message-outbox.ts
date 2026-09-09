import "server-only";

import { errorCodeFrom } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { MessageProvider } from "@/lib/message-provider";
import { deliverClaimedMessage, type DeliveryMessage } from "@/lib/message-delivery";
import { deliveryAllowed } from "@/lib/message-delivery-policy";

const MAX_ATTEMPTS = 5;

export async function processMessageOutbox(provider: MessageProvider, limit = 20) {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const staleLease = new Date(now.getTime() - 15 * 60_000).toISOString();
  const { error: leaseError } = await admin
    .from("message_outbox")
    .update({
      status: "retry",
      processing_started_at: null,
      next_attempt_at: now.toISOString(),
      last_error_code: "worker_lease_expired",
    })
    .eq("status", "processing")
    .lte("processing_started_at", staleLease);
  if (leaseError) throw leaseError;

  const { data, error } = await admin
    .from("message_outbox")
    .select("id, customer_id, purpose, channel, recipient, subject, body, idempotency_key, attempt_count")
    .in("status", ["queued", "retry"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("queued_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let accepted = 0;
  let failed = 0;
  let blocked = 0;
  for (const row of data ?? []) {
    const nextAttempt = row.attempt_count + 1;
    const processingStartedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("message_outbox")
      .update({
        status: "processing",
        attempt_count: nextAttempt,
        provider_name: provider.name,
        processing_started_at: processingStartedAt,
      })
      .eq("id", row.id)
      .in("status", ["queued", "retry"])
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    const outcome = await deliverClaimedMessage(row as DeliveryMessage, {
      provider,
      isAllowed: message => deliveryAllowed(admin, message),
      async recordBlocked() {
        const { data: recorded, error: blockedError } = await admin.rpc("apply_message_delivery_event_v1", {
          p_outbox_id: row.id,
          p_status: "failed",
          p_error_code: "delivery_permission_revoked_or_customer_inactive",
        });
        if (blockedError) throw blockedError;
        if (!recorded) throw new Error("message_delivery_record_missing");
      },
      async recordAccepted(result) {
        const { data: recorded, error: receiptError } = await admin.rpc("apply_message_delivery_event_v1", {
          p_outbox_id: row.id,
          p_status: "accepted",
          p_provider_message_id: result.providerMessageId,
        });
        if (receiptError) throw receiptError;
        if (!recorded) throw new Error("message_delivery_record_missing");
      },
      async recordSendError(sendError) {
        const errorCode = errorCodeFrom(sendError);
        const terminal = nextAttempt >= MAX_ATTEMPTS;
        if (terminal) {
          const { data: recorded, error: terminalError } = await admin.rpc("apply_message_delivery_event_v1", {
            p_outbox_id: row.id,
            p_status: "failed",
            p_error_code: errorCode,
          });
          if (terminalError) throw terminalError;
          if (!recorded) throw new Error("message_delivery_record_missing");
        } else {
          const { error: retryError } = await admin.from("message_outbox").update({
            status: "retry",
            processing_started_at: null,
            last_error_code: errorCode,
            failed_at: null,
            next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** nextAttempt) * 60_000).toISOString(),
          }).eq("id", row.id);
          if (retryError) throw retryError;
        }
      },
    });
    if (outcome === "accepted") accepted += 1;
    else if (outcome === "blocked") blocked += 1;
    else failed += 1;
  }
  return { accepted, failed, blocked };
}
