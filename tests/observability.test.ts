import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRequestId,
  errorCodeFrom,
  isRequestId,
  observedRoute,
  requestIdFrom,
  structuredLog,
} from "../src/lib/observability";

describe("observability primitives", () => {
  it("creates UUID request identifiers and ignores malformed incoming values", () => {
    const generated = createRequestId();
    assert.equal(isRequestId(generated), true);
    assert.equal(isRequestId("customer@example.com"), false);

    const request = new Request("https://example.test/api/test", {
      headers: { "x-request-id": "not-a-valid-request-id" },
    });
    assert.equal(isRequestId(requestIdFrom(request)), true);
  });

  it("keeps safe error codes without serializing error messages", () => {
    const error = Object.assign(new Error("customer@example.com token=secret"), { code: "PGRST116" });
    assert.equal(errorCodeFrom(error), "PGRST116");
  });

  it("emits allowlisted JSON fields and drops unsafe values", () => {
    const original = console.info;
    let output = "";
    console.info = (value?: unknown) => {
      output = String(value);
    };
    try {
      structuredLog("info", "http.request.received", {
        requestId: "b1c0a47d-9f4e-4a3e-9a67-f18a87c823b0",
        route: "/api/customers",
        method: "post",
        operation: "token=must-not-appear",
      });
    } finally {
      console.info = original;
    }

    const parsed = JSON.parse(output) as Record<string, unknown>;
    assert.equal(parsed.event, "http.request.received");
    assert.equal(parsed.method, "POST");
    assert.equal(parsed.operation, undefined);
    assert.doesNotMatch(output, /must-not-appear/);
  });

  it("adds the correlation id and logs completion without response data", async () => {
    const requestId = createRequestId();
    const logs: string[] = [];
    const originalInfo = console.info;
    console.info = (value?: unknown) => logs.push(String(value));

    try {
      const handler = observedRoute("health.live", async () => Response.json({
        status: "ok",
        customer_email: "private@example.com",
      }));
      const response = await handler(
        new Request("https://crm.example/api/health/live", {
          headers: { "x-request-id": requestId },
        }),
        undefined,
      );

      assert.equal(response.headers.get("x-request-id"), requestId);
      assert.equal(logs.length, 1);
      const payload = JSON.parse(logs[0]) as Record<string, unknown>;
      assert.equal(payload.event, "http.request.completed");
      assert.equal(payload.operation, "health.live");
      assert.equal(payload.status, 200);
      assert.equal(payload.customer_email, undefined);
      assert.equal(logs[0].includes("private@example.com"), false);
    } finally {
      console.info = originalInfo;
    }
  });

  it("converts unhandled failures to a safe correlated response", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (value?: unknown) => errors.push(String(value));

    try {
      const handler = observedRoute("test.failure", async () => {
        throw Object.assign(new Error("customer secret"), { code: "DB_TIMEOUT" });
      });
      const response = await handler(
        new Request("https://crm.example/api/test"),
        undefined,
      );
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 500);
      assert.match(String(body.request_id), /^[0-9a-f-]{36}$/i);
      assert.equal(body.error, "Beklenmeyen sunucu hatası.");
      assert.equal(errors[0].includes("customer secret"), false);
      assert.equal(JSON.parse(errors[0]).error_code, "DB_TIMEOUT");
    } finally {
      console.error = originalError;
    }
  });
});
