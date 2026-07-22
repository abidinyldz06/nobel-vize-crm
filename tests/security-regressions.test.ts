import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const projectRoot = process.cwd();

async function collectSqlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSqlFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".sql") ? [fullPath] : [];
  }));
  return nested.flat();
}
describe("security regression guards", () => {
  it("does not ship SQL that disables RLS or exposes all portal rows", async () => {
    const sqlFiles = await collectSqlFiles(path.join(projectRoot, "supabase"));

    for (const sqlFile of sqlFiles) {
      const sql = await readFile(sqlFile, "utf8");
      assert.doesNotMatch(sql, /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i, sqlFile);
      assert.doesNotMatch(sql, /TO\s+anon\s+USING\s*\(\s*true\s*\)/i, sqlFile);
      assert.doesNotMatch(
        sql,
        /VALUES\s*\(\s*['"]documents['"]\s*,\s*['"]documents['"]\s*,\s*true\s*\)/i,
        sqlFile,
      );
    }
  });

  it("does not restore the shared staff password", async () => {
    const staffAction = await readFile(path.join(projectRoot, "src/app/actions/staff.ts"), "utf8");
    assert.doesNotMatch(staffAction, /123456/);
    assert.match(staffAction, /inviteUserByEmail/);
  });

  it("keeps webhook service access behind signature verification", async () => {
    const webhookRoute = await readFile(
      path.join(projectRoot, "src/app/api/webhook/google-form/route.ts"),
      "utf8",
    );
    assert.match(webhookRoute, /verifySignedWebhook/);
    assert.match(webhookRoute, /webhook_events/);
    assert.doesNotMatch(webhookRoute, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("does not treat a missing staff record as admin", async () => {
    const sourceRoot = path.join(projectRoot, "src");
    const files = await collectSourceFiles(sourceRoot);
    for (const sourceFile of files) {
      const source = await readFile(sourceFile, "utf8");
      assert.doesNotMatch(source, /!staffRecord\s*\|\|\s*staffRecord\.role\s*===\s*['"]admin['"]/, sourceFile);
    }
  });

  it("keeps customer deletion behind the admin-only archive workflow", async () => {
    const [actionMenu, bulkRoute, migration] = await Promise.all([
      readFile(path.join(projectRoot, "src/components/CustomerActionMenu.tsx"), "utf8"),
      readFile(path.join(projectRoot, "src/app/api/customers/bulk/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "supabase/migrations/202607220001_customer_soft_delete.sql"), "utf8"),
    ]);

    assert.doesNotMatch(actionMenu, /\.from\(['"]customers['"]\)\.delete\(/);
    assert.doesNotMatch(bulkRoute, /\.from\(['"]customers['"]\)\.delete\(/);
    assert.match(actionMenu, /archive_customers_v1/);
    assert.match(bulkRoute, /archive_customers_v1/);
    assert.match(migration, /IF NOT public\.is_admin\(\) THEN/);
    assert.match(migration, /Müşteri silindi:/);
  });
});

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}
