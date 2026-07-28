import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { summarizeLeadSla, summarizePaymentAging } from "../src/lib/advanced-report-metrics.ts";

const root = process.cwd();

describe("phase 4.6 controlled privacy lifecycle", () => {
  it("keeps dry-run, legal hold, two-person purge and verified backup gates", async () => {
    const [migration, route, schedule] = await Promise.all([
      readFile(path.join(root, "supabase/migrations/202607280008_phase46_privacy_lifecycle_automation.sql"), "utf8"),
      readFile(path.join(root, "src/app/api/cron/privacy/route.ts"), "utf8"),
      readFile(path.join(root, "vercel.json"), "utf8"),
    ]);
    assert.match(migration, /list_privacy_lifecycle_candidates_v1/);
    assert.match(migration, /retention_hold_active/);
    assert.match(migration, /WHEN p_action_type = 'purge' THEN 2/);
    assert.match(migration, /verified_backup_after_approval_required/);
    assert.match(migration, /storage_cleanup_required/);
    assert.match(route, /automatic_actions_enabled/);
    assert.match(schedule, /api\/cron\/privacy/);
  });
});

describe("phase 4.7 lead operations", () => {
  it("normalizes duplicates, requires explicit conversion and reuses task automation", async () => {
    const [migration, operations] = await Promise.all([
      readFile(path.join(root, "supabase/migrations/202607280009_phase47_lead_operations.sql"), "utf8"),
      readFile(path.join(root, "src/app/api/cron/operations/route.ts"), "utf8"),
    ]);
    assert.match(migration, /phone_normalized TEXT GENERATED ALWAYS/);
    assert.match(migration, /lead_duplicate_confirmation_required/);
    assert.match(migration, /create_customer_application_v1/);
    assert.match(migration, /ON CONFLICT \(idempotency_key\)/);
    assert.match(operations, /sync_lead_followup_tasks_v1/);
  });
});

describe("phase 4.8 calendar and canonical reporting", () => {
  it("calculates payment aging and lead SLA deterministically", () => {
    const now = new Date("2026-07-28T12:00:00Z");
    const aging = summarizePaymentAging([
      { amount: 100, status: "bekliyor", created_at: "2026-07-27T12:00:00Z" },
      { amount: 250, status: "bekliyor", created_at: "2026-06-01T12:00:00Z" },
      { amount: 999, status: "alindi", created_at: "2026-01-01T00:00:00Z" },
    ], now);
    assert.deepEqual(aging.map((row) => [row.label, row.count, row.amount]), [
      ["0-7 gün", 1, 100], ["8-30 gün", 0, 0], ["31-60 gün", 1, 250], ["60+ gün", 0, 0],
    ]);
    assert.deepEqual(summarizeLeadSla([
      { status: "new", follow_up_due_at: "2026-07-28T11:00:00Z" },
      { status: "qualified", follow_up_due_at: "2026-07-29T10:00:00Z" },
      { status: "converted", follow_up_due_at: "2026-07-20T00:00:00Z" },
    ], now), { open: 2, overdue: 1, dueSoon: 1 });
  });

  it("offers conflict history plus permissioned ICS, CSV and PDF exports", async () => {
    const files = await Promise.all([
      readFile(path.join(root, "supabase/migrations/202607280010_phase48_calendar_reporting.sql"), "utf8"),
      readFile(path.join(root, "src/app/api/appointments/[id]/ics/route.ts"), "utf8"),
      readFile(path.join(root, "src/app/api/reports/export.csv/route.ts"), "utf8"),
      readFile(path.join(root, "src/app/api/reports/export.pdf/route.ts"), "utf8"),
    ]);
    assert.match(files[0], /list_appointment_conflicts_v1/);
    assert.match(files[0], /appointment_events_immutable/);
    assert.match(files[1], /requireStaff/);
    assert.match(files[1], /text\/calendar/);
    assert.match(files[2], /loadAdvancedReport/);
    assert.match(files[3], /loadAdvancedReport/);
  });
});

describe("phase 4.9 maintenance gates", () => {
  it("schedules dependency audits and avoids automatic major upgrades", async () => {
    const [dependabot, workflow] = await Promise.all([
      readFile(path.join(root, ".github/dependabot.yml"), "utf8"),
      readFile(path.join(root, ".github/workflows/dependency-audit.yml"), "utf8"),
    ]);
    assert.match(dependabot, /version-update:semver-major/);
    assert.match(dependabot, /patch-and-minor/);
    assert.match(workflow, /npm run audit:production/);
    assert.match(workflow, /workflow_dispatch/);
  });
});
