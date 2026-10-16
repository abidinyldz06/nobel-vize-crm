import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portalAttemptKeys } from "../src/lib/portal-rate-limit";

describe("portal attempt keys", () => {
  it("keeps the reference and address out of the stored key", () => {
    const token = "11111111-1111-4111-8111-111111111111";
    const keys = portalAttemptKeys("203.0.113.10, 10.0.0.1", token);
    assert.equal(keys.pair.length, 64);
    assert.equal(keys.ip.length, 64);
    assert.notEqual(keys.pair, keys.ip);
    assert.equal(keys.pair.includes(token), false);
    assert.equal(keys.ip.includes("203.0.113.10"), false);
    assert.deepEqual(portalAttemptKeys("203.0.113.10", token), keys);
  });
});
