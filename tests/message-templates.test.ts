import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  renderMessageTemplate,
  unknownMessageTemplateVariables,
} from "../src/lib/message-templates";

describe("message templates", () => {
  it("renders supported variables and preserves normal text", () => {
    assert.equal(
      renderMessageTemplate("Merhaba {{ first_name }}, {{country}} dosyanız hazır.", {
        first_name: "Ayşe",
        country: "Fransa",
      }),
      "Merhaba Ayşe, Fransa dosyanız hazır.",
    );
  });

  it("replaces missing supported values with empty text", () => {
    assert.equal(renderMessageTemplate("{{first_name}} / {{portal_url}}", { first_name: "Ayşe" }), "Ayşe / ");
  });

  it("reports unsupported variables without silently removing them", () => {
    assert.deepEqual(unknownMessageTemplateVariables("{{first_name}} {{secret}} {{secret}}"), ["secret"]);
    assert.equal(renderMessageTemplate("{{secret}}", {}), "{{secret}}");
  });
});
