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

  it("keeps tasks and notification reads behind recipient-scoped workflows", async () => {
    const [taskRoute, notificationRoute, migration] = await Promise.all([
      readFile(path.join(projectRoot, "src/app/api/tasks/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "src/app/api/notifications/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "supabase/migrations/202607220002_phase3_tasks_notifications.sql"), "utf8"),
    ]);

    assert.match(taskRoute, /create_task_v1/);
    assert.match(taskRoute, /set_task_status_v1/);
    assert.match(notificationRoute, /mark_notification_read_v1/);
    assert.match(notificationRoute, /mark_all_notifications_read_v1/);
    assert.doesNotMatch(notificationRoute, /\.from\(['"]activity_log['"]\)/);
    assert.match(migration, /recipient_staff_id = public\.current_staff_id\(\)/);
    assert.match(migration, /task_assignee_customer_mismatch/);
    assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.tasks, public\.notifications FROM authenticated/);
  });

  it("keeps application status changes behind controlled audited workflows", async () => {
    const [statusRoute, bulkRoute, appointmentAction, migration] = await Promise.all([
      readFile(path.join(projectRoot, "src/app/api/applications/status/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "src/app/api/customers/bulk/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "src/app/actions/update-customer.ts"), "utf8"),
      readFile(path.join(projectRoot, "supabase/migrations/202607220003_phase34_application_workflow.sql"), "utf8"),
    ]);

    assert.match(statusRoute, /update_application_status_v1/);
    assert.match(bulkRoute, /bulk_update_application_status_v1/);
    assert.match(appointmentAction, /set_application_appointment_v1/);
    assert.doesNotMatch(bulkRoute, /\.from\(['"]applications['"]\)[\s\S]{0,200}?\.update\(/);
    assert.doesNotMatch(appointmentAction, /\.from\(['"]applications['"]\)[\s\S]{0,200}?\.update\(/);
    assert.match(migration, /application_status_transition_allowed/);
    assert.match(migration, /REVOKE UPDATE ON TABLE public\.applications FROM authenticated/);
    assert.match(migration, /INSERT INTO public\.activity_log/);
  });

  it("keeps customer tags inside backup and atomic restore coverage", async () => {
    const [backupRoute, migration] = await Promise.all([
      readFile(path.join(projectRoot, "src/app/api/backup/route.ts"), "utf8"),
      readFile(path.join(projectRoot, "supabase/migrations/202607220006_phase34_tag_backup.sql"), "utf8"),
    ]);

    assert.match(backupRoute, /"tags"/);
    assert.match(backupRoute, /"customer_tags"/);
    assert.match(migration, /INSERT INTO public\.tags/);
    assert.match(migration, /INSERT INTO public\.customer_tags/);
    assert.match(migration, /backup_tags_required_for_customer_tags/);
  });

  it("keeps communication and portal mutations behind controlled workflows", async () => {
    const migration = await readFile(path.join(projectRoot, "supabase/migrations/202607220008_phase35_communication_portal.sql"), "utf8");
    const communicationPanel = await readFile(path.join(projectRoot, "src/components/CommunicationPanel.tsx"), "utf8");
    const portalShare = await readFile(path.join(projectRoot, "src/components/PortalShareButton.tsx"), "utf8");

    assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.communications FROM authenticated/i);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.record_communication_v1/i);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.rotate_customer_portal_token_v1/i);
    assert.doesNotMatch(communicationPanel, /\.from\(["']communications["']\)\s*\.insert/i);
    assert.doesNotMatch(portalShare, /\.from\(["']customers["']\)\s*\.update/i);
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
