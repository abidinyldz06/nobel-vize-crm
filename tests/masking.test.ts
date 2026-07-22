import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskEmail, maskPassport, maskPhone } from "../src/lib/masking";

describe("sensitive value masking", () => {
  it("keeps only minimal phone context", () => assert.equal(maskPhone("+90 555 123 45 67"), "90••••••67"));
  it("masks both email local part and domain", () => assert.equal(maskEmail("abidin@example.com"), "a•••@e•••.com"));
  it("keeps only passport edge characters", () => assert.equal(maskPassport("U12345678"), "U1•••••78"));
});
