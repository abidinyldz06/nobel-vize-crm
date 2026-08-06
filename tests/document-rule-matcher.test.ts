import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDocumentRules,
  selectBestDocumentRule,
  selectMatchingDocumentRules,
  type DocumentRuleEntry,
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

function ruleWithDocuments(
  id: string,
  documents: DocumentRuleEntry[],
  overrides: Partial<DocumentRuleProfile> = {},
) {
  return { ...rule(id, overrides), parsedDocuments: documents };
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

  it("combines the general rule with every explicit profile overlay", () => {
    const general = rule("general");
    const student = rule("student", { occupation: "ogrenci" });
    const children = rule("children", { with_children: true });
    const wrong = rule("wrong", { accommodation: "otel" });

    assert.deepEqual(
      selectMatchingDocumentRules(
        [children, wrong, student, general],
        { occupation: "ogrenci", with_children: true, accommodation: "aile_arkadas" },
      ).map(item => item.id),
      ["general", "children", "student"],
    );
  });

  it("does not activate profile overlays for empty fields when a general rule exists", () => {
    const general = rule("general");
    const flight = rule("flight", { travel_method: "ucak" });

    assert.deepEqual(
      selectMatchingDocumentRules([flight, general], { travel_method: "" }).map(item => item.id),
      ["general"],
    );
  });

  it("keeps the legacy single-rule fallback when no general rule exists", () => {
    const flight = rule("flight", { travel_method: "ucak" });

    assert.deepEqual(
      selectMatchingDocumentRules([flight], { travel_method: "" }).map(item => item.id),
      ["flight"],
    );
  });

  it("deduplicates documents and preserves required status across overlays", () => {
    const general = ruleWithDocuments("general", [
      { name: "Pasaport", required: true, description: "Genel açıklama" },
      { name: "Fotoğraf", required: true },
    ]);
    const student = ruleWithDocuments("student", [
      { name: "  pasaport  ", required: false, description: "Profile özel açıklama" },
      { name: "Öğrenci Belgesi", required: true },
    ], { occupation: "ogrenci" });

    const resolution = resolveDocumentRules([student, general], { occupation: "ogrenci" });

    assert.deepEqual(resolution.rules.map(item => item.id), ["general", "student"]);
    assert.deepEqual(resolution.documents, [
      { name: "Pasaport", required: true, description: "Profile özel açıklama" },
      { name: "Fotoğraf", required: true },
      { name: "Öğrenci Belgesi", required: true },
    ]);
  });
});
