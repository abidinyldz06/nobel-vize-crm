import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import ts from "typescript";

it("leaves mobile zoom unrestricted while preserving the PWA viewport", async () => {
  const source = await readFile("src/app/layout.tsx", "utf8");
  const file = ts.createSourceFile("layout.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = file.statements
    .filter(ts.isVariableStatement)
    .flatMap(statement => statement.declarationList.declarations)
    .find(item => ts.isIdentifier(item.name) && item.name.text === "viewport");
  assert.ok(declaration?.initializer && ts.isObjectLiteralExpression(declaration.initializer));
  const fields = new Map(declaration.initializer.properties
    .filter(ts.isPropertyAssignment)
    .map(property => [property.name.getText(file), property.initializer.getText(file)]));
  assert.equal(fields.get("width"), '"device-width"');
  assert.equal(fields.get("initialScale"), "1");
  assert.equal(fields.get("viewportFit"), '"cover"');
  assert.equal(fields.get("themeColor"), '"#07101f"');
  assert.equal(fields.has("maximumScale"), false);
  assert.equal(fields.has("userScalable"), false);
});
