import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectBestDocumentRule,
  type DocumentRuleProfile,
} from "../src/lib/document-rule-matcher";

function rule(
  id: string,
  overrides: Partial<DocumentRuleProfile> = {},
): DocumentRuleProfile {
  return {
    id,
    created_at: "2026-01-01T00:00:00.000Z",
    travel_method: null,
    accommodation: null,
    occupation: null,
    with_children: null,
    nationality: null,
    ...overrides,
  };
}

describe("document rule matcher", () => {
  it("does not reject a specific rule when the dropdown is empty", () => {
    const specific = rule("specific", { travel_method: "ucak" });
    assert.equal(
      selectBestDocumentRule([specific], { travel_method: "" })?.id,
      "specific",
    );
  });

  it("prefers the general fallback when an unselected field has variants", () => {
    const specific = rule("specific", { travel_method: "ucak" });
    const general = rule("general");
    assert.equal(
      selectBestDocumentRule([specific, general], { travel_method: "" })?.id,
      "general",
    );
  });

  it("prefers exact selected values over the general fallback", () => {
    const general = rule("general");
    const exact = rule("exact", {
      travel_method: "ucak",
      accommodation: "otel",
    });
    assert.equal(
      selectBestDocumentRule([general, exact], {
        travel_method: "ucak",
        accommodation: "otel",
      })?.id,
      "exact",
    );
  });

  it("rejects only an explicit mismatch and remains deterministic", () => {
    const wrong = rule("wrong", { travel_method: "gemi" });
    const later = rule("later", { created_at: "2026-02-01T00:00:00.000Z" });
    const earlier = rule("earlier");
    assert.equal(
      selectBestDocumentRule([wrong, later, earlier], {
        travel_method: "ucak",
      })?.id,
      "earlier",
    );
  });
});
