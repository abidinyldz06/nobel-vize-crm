import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const projectRoot = process.cwd();
const migrationsRoot = path.join(projectRoot, "supabase", "migrations");

describe("phase 3.8 release gates", () => {
  it("keeps migration versions unique, ordered and convention-compliant", async () => {
    const migrations = (await readdir(migrationsRoot))
      .filter(file => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));
    const versions = migrations.map(file => {
      const match = /^(\d{12})_[a-z0-9_]+\.sql$/.exec(file);
      assert.ok(match, `Geçersiz migration dosya adı: ${file}`);
      return match[1];
    });

    assert.equal(new Set(versions).size, versions.length, "Migration sürümleri benzersiz olmalı");
    for (let index = 1; index < versions.length; index += 1) {
      assert.ok(versions[index - 1] < versions[index], "Migration sürümleri kesin artmalı");
    }
  });

  it("keeps the closing security migration and database release test together", async () => {
    const [migration, legacyDriftMigration, databaseTest] = await Promise.all([
      readFile(
        path.join(migrationsRoot, "202607260003_phase38_security_closure.sql"),
        "utf8",
      ),
      readFile(
        path.join(migrationsRoot, "202607260004_phase38_legacy_appointments_rls.sql"),
        "utf8",
      ),
      readFile(
        path.join(projectRoot, "supabase", "tests", "phase38_release_gates.test.sql"),
        "utf8",
      ),
    ]);

    assert.match(migration, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon/);
    assert.match(migration, /REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon/);
    assert.match(migration, /staff_active_requires_auth_link/);
    assert.match(legacyDriftMigration, /ALTER TABLE public\.appointments ENABLE ROW LEVEL SECURITY/);
    assert.match(legacyDriftMigration, /REVOKE ALL PRIVILEGES ON TABLE public\.appointments FROM PUBLIC, anon/);
    assert.match(databaseTest, /every public application table has RLS enabled/);
    assert.match(databaseTest, /audit actor trigger remains attached/);
  });

  it("keeps CI release gates complete and production dependency audit blocking", async () => {
    const workflow = await readFile(
      path.join(projectRoot, ".github", "workflows", "quality.yml"),
      "utf8",
    );

    for (const requiredStep of [
      "npm run lint",
      "npm run typecheck",
      "npm test",
      "npm run audit:production",
      "npm run build",
      "npm run db:reset",
      "Verify generated database types",
      "npm run db:lint",
      "npm run db:test",
      "npm run restore:drill",
      "npm run test:e2e:local",
    ]) {
      const escapedStep = requiredStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(workflow, new RegExp(escapedStep));
    }
  });
});
