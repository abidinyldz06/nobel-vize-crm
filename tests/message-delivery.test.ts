import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { deliveryAllowed } from "../src/lib/message-delivery-policy";
import { deliverClaimedMessage, type DeliveryMessage, type DeliveryDependencies } from "../src/lib/message-delivery";

const message: DeliveryMessage = {
  id: "queued-message", customer_id: "customer", purpose: "transactional",
  channel: "email", recipient: "synthetic@example.test", subject: "Test", body: "Test",
  idempotency_key: "stable-test-message",
};

function fixture() {
  const events: string[] = [];
  const dependencies: DeliveryDependencies = {
    async isAllowed() { events.push("permission"); return true; },
    provider: { name: "test", async send() { events.push("send"); return { providerName: "test", providerMessageId: "receipt" }; } },
    async recordBlocked() { events.push("blocked"); },
    async recordAccepted() { events.push("accepted"); },
    async recordSendError() { events.push("retry"); },
  };
  return { dependencies, events };
}

describe("message delivery gate", () => {
  it("sends only after current permission is checked and saves the receipt", async () => {
    const { dependencies, events } = fixture();
    assert.equal(await deliverClaimedMessage(message, dependencies), "accepted");
    assert.deepEqual(events, ["permission", "send", "accepted"]);
  });

  it("blocks queued and retried messages when current permission was withdrawn", async () => {
    const { dependencies, events } = fixture();
    let allowed = true;
    dependencies.isAllowed = async () => allowed;
    // The message was prepared while permission was granted; it changes before delivery.
    allowed = false;
    assert.equal(await deliverClaimedMessage(message, dependencies), "blocked");
    assert.equal(await deliverClaimedMessage(message, dependencies), "blocked");
    assert.deepEqual(events, ["blocked", "blocked"]);
  });

  it("does not send when permission lookup fails", async () => {
    const { dependencies, events } = fixture();
    dependencies.isAllowed = async () => { throw new Error("DB unavailable"); };
    await assert.rejects(deliverClaimedMessage(message, dependencies), /DB unavailable/);
    assert.deepEqual(events, []);
  });

  it("does not claim success or provider failure when receipt persistence fails", async () => {
    const { dependencies, events } = fixture();
    dependencies.recordAccepted = async () => { throw new Error("receipt failed"); };
    await assert.rejects(deliverClaimedMessage(message, dependencies), /receipt failed/);
    assert.deepEqual(events, ["permission", "send"]);
  });

  it("retries actual provider failures without recording an accepted delivery", async () => {
    const { dependencies, events } = fixture();
    dependencies.provider.send = async () => { events.push("send"); throw new Error("provider timeout"); };
    assert.equal(await deliverClaimedMessage(message, dependencies), "failed");
    assert.deepEqual(events, ["permission", "send", "retry"]);
  });

  it("surfaces failed rejection persistence instead of silently dropping the message", async () => {
    const { dependencies, events } = fixture();
    dependencies.isAllowed = async () => false;
    dependencies.recordBlocked = async () => { throw new Error("rejection failed"); };
    await assert.rejects(deliverClaimedMessage(message, dependencies), /rejection failed/);
    assert.deepEqual(events, []);
  });
});

describe("current database delivery permission", () => {
  function database(rows: Record<string, unknown>, failure?: string) {
    return createClient<Database>("https://synthetic.supabase.test", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").pop()!;
        if (table === failure) return Response.json({ message: "unavailable", code: "DB_FAILURE" }, { status: 503 });
        if (table === "customers") assert.equal(url.searchParams.get("is_deleted"), "eq.false");
        if (table === "communication_preferences") {
          assert.equal(url.searchParams.get("customer_id"), "eq.customer");
          assert.equal(url.searchParams.get("channel"), "eq.email");
        }
        if (table === "customer_consents") {
          assert.equal(url.searchParams.get("limit"), "1");
          assert.equal(url.searchParams.get("order"), "decision_at.desc,created_at.desc,id.desc");
        }
        return Response.json(rows[table] ?? null);
      } },
    });
  }

  it("requires both an active customer and a current positive preference", async () => {
    const rows = { customers: { id: "customer" }, communication_preferences: { allowed: true } };
    assert.equal(await deliveryAllowed(database(rows), message), true);
    assert.equal(await deliveryAllowed(database({ ...rows, customers: null }), message), false);
    assert.equal(await deliveryAllowed(database({ ...rows, communication_preferences: { allowed: false } }), message), false);
    assert.equal(await deliveryAllowed(database({ ...rows, communication_preferences: null }), message), false);
  });

  it("requires the latest marketing consent and fails closed on read errors", async () => {
    const marketing = { ...message, purpose: "marketing" };
    const rows = { customers: { id: "customer" }, communication_preferences: { allowed: true } };
    for (const decision of ["withdrawn", "refused", "granted"]) {
      assert.equal(await deliveryAllowed(database({ ...rows, customer_consents: { decision } }), marketing), decision === "granted");
    }
    assert.equal(await deliveryAllowed(database(rows), marketing), false);
    for (const table of ["customers", "communication_preferences", "customer_consents"]) {
      await assert.rejects(deliveryAllowed(database(rows, table), marketing));
    }
  });
});
