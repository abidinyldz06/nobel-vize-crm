import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyHmacSha256Signature } from "../src/lib/webhook-signature.ts";

async function createSignature(secret: string, timestamp: string, eventId: string, rawBody: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${eventId}.${rawBody}`)),
  );

  return `sha256=${Array.from(signature, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("verifyHmacSha256Signature", () => {
  it("accepts a valid signature", async () => {
    const secret = "a-secure-test-secret-with-at-least-32-bytes";
    const timestamp = "1784527200";
    const eventId = "8bd3212e-ad7b-4b18-988b-bf45b0b99933";
    const rawBody = JSON.stringify({ firstName: "Abidin", phone: "+905551112233" });
    const signature = await createSignature(secret, timestamp, eventId, rawBody);

    assert.equal(
      await verifyHmacSha256Signature(secret, timestamp, eventId, rawBody, signature),
      true,
    );
  });

  it("rejects a modified body", async () => {
    const secret = "a-secure-test-secret-with-at-least-32-bytes";
    const timestamp = "1784527200";
    const eventId = "8bd3212e-ad7b-4b18-988b-bf45b0b99933";
    const signature = await createSignature(secret, timestamp, eventId, '{"amount":100}');

    assert.equal(
      await verifyHmacSha256Signature(secret, timestamp, eventId, '{"amount":9000}', signature),
      false,
    );
  });

  it("rejects a modified event id", async () => {
    const secret = "a-secure-test-secret-with-at-least-32-bytes";
    const timestamp = "1784527200";
    const originalEventId = "8bd3212e-ad7b-4b18-988b-bf45b0b99933";
    const rawBody = "{}";
    const signature = await createSignature(secret, timestamp, originalEventId, rawBody);

    assert.equal(
      await verifyHmacSha256Signature(
        secret,
        timestamp,
        "fc57d36c-6879-4cc4-9db3-a2887618520b",
        rawBody,
        signature,
      ),
      false,
    );
  });

  it("rejects malformed signatures without throwing", async () => {
    assert.equal(
      await verifyHmacSha256Signature("secret", "1784527200", "8bd3212e-ad7b-4b18-988b-bf45b0b99933", "{}", "not-a-signature"),
      false,
    );
  });
});
