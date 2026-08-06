import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getVisaRuleSourceStatus,
  parseVisaRuleSources,
} from "../src/lib/visa-rule-sources";

describe("visa rule source status", () => {
  it("accepts only complete official or secondary source entries", () => {
    assert.deepEqual(parseVisaRuleSources([
      { title: "Resmî", url: "https://example.test/official", kind: "official" },
      { title: "Eksik", url: "", kind: "secondary" },
      { title: "İkincil", url: "https://example.test/reference", kind: "secondary" },
    ]), [
      { title: "Resmî", url: "https://example.test/official", kind: "official" },
      { title: "İkincil", url: "https://example.test/reference", kind: "secondary" },
    ]);
  });

  it("marks a current checked official source as verified", () => {
    assert.equal(getVisaRuleSourceStatus([{
      title: "Resmî",
      url: "https://example.test/official",
      kind: "official",
      checked_at: "2026-08-06T09:00:00+03:00",
      review_due_at: "2026-11-04",
    }], "2026-08-06"), "verified");
  });

  it("separates due, secondary and pending source states", () => {
    assert.equal(getVisaRuleSourceStatus([{
      title: "Süresi dolmuş resmî kaynak",
      url: "https://example.test/official",
      kind: "official",
      checked_at: "2026-01-01T00:00:00Z",
      review_due_at: "2026-02-01",
    }], "2026-08-06"), "review_due");

    assert.equal(getVisaRuleSourceStatus([{
      title: "İkincil",
      url: "https://example.test/reference",
      kind: "secondary",
      checked_at: "2026-08-06T09:00:00+03:00",
    }], "2026-08-06"), "secondary");

    assert.equal(getVisaRuleSourceStatus([{
      title: "Kontrol bekleyen resmî kaynak",
      url: "https://example.test/official",
      kind: "official",
    }], "2026-08-06"), "review_pending");
    assert.equal(getVisaRuleSourceStatus([], "2026-08-06"), "unverified");
  });
});
