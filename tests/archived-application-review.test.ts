import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { reviewArchivedOpenApplications, type ArchivedApplicationRow } from "../src/lib/archived-application-review";
import { summarizeDataQuality, type QualityDataset } from "../src/lib/data-quality-summary";

const application = (override: Partial<ArchivedApplicationRow> = {}): ArchivedApplicationRow => ({
  id: "application-open",
  customer_id: "archived-customer",
  status: "profil_analizi",
  updated_at: "2026-09-01T09:00:00Z",
  assigned_staff_id: null,
  ...override,
});

describe("archived open application review", () => {
  it("keeps appeal status open and drops closed, active-customer and unrelated rows", () => {
    const input = {
      applications: [
        application({ id: "appeal", status: "itiraz", updated_at: "2026-09-02T09:00:00Z" }),
        application({ id: "closed", status: "kapandi" }),
        application({ id: "approved", status: "onaylandi" }),
        application({ id: "rejected", status: "reddedildi" }),
        application({ id: "active-customer", customer_id: "active-customer", assigned_staff_id: "active-staff" }),
      ],
      customers: [{ id: "archived-customer", assignedStaffId: null }],
      staff: [{ id: "active-staff", is_active: true }],
    };
    const original = structuredClone(input);
    const result = reviewArchivedOpenApplications(input);
    assert.deepEqual(result.map(row => row.id), ["appeal"]);
    assert.equal(result[0]?.assignee, "none");
    assert.deepEqual(input, original);
  });

  it("uses an active customer owner when the application owner is missing or inactive", () => {
    const rows = reviewArchivedOpenApplications({
      applications: [
        application({ id: "fallback", assigned_staff_id: "inactive-staff", updated_at: "2026-09-03T09:00:00Z" }),
        application({ id: "older", assigned_staff_id: " ", updated_at: "2026-08-01T09:00:00Z" }),
      ],
      customers: [{ id: "archived-customer", assignedStaffId: "active-staff" }],
      staff: [{ id: "active-staff", is_active: true }, { id: "inactive-staff", is_active: false }],
    });
    assert.deepEqual(rows.map(row => [row.id, row.assignee]), [["fallback", "active"], ["older", "active"]]);
  });

  it("marks a present but inactive owner without treating a blank id as assigned", () => {
    const [row] = reviewArchivedOpenApplications({
      applications: [application({ assigned_staff_id: "former-staff" })],
      customers: [{ id: "archived-customer", assignedStaffId: "  " }],
      staff: [{ id: "former-staff", is_active: false }],
    });
    assert.equal(row?.assignee, "inactive");
  });

  it("uses the same open set as the quality summary", () => {
    const dataset: QualityDataset = {
      customers: [],
      applications: [
        { id: "appeal", customer_id: "archived-customer", status: "itiraz", country_id: null, country: "", visa_type: "", assigned_staff_id: null, travel_method: null, accommodation: null, occupation: null, with_children: null, nationality: null },
        { id: "closed", customer_id: "archived-customer", status: "onaylandi", country_id: null, country: "", visa_type: "", assigned_staff_id: null, travel_method: null, accommodation: null, occupation: null, with_children: null, nationality: null },
      ],
      tasks: [],
      staff: [],
      archivedCustomerIds: ["archived-customer"],
    };
    assert.equal(summarizeDataQuality(dataset, new Date("2026-10-02T08:00:00Z")).archivedOpenApplications, 1);
  });
});

describe("archive review access boundary", () => {
  it("reads through the admin session, selects no personal fields and does not write", async () => {
    const page = await readFile(new URL("../src/app/(main)/customers/archive/page.tsx", import.meta.url), "utf8");
    const panel = await readFile(new URL("../src/components/DataQualityPanel.tsx", import.meta.url), "utf8");
    assert.match(page, /requireAdminPage\(\)/);
    assert.match(page, /list_archived_customers_v1/);
    assert.match(page, /select\("id,customer_id,status,updated_at,assigned_staff_id"/);
    assert.match(page, /select\("id,is_active"/);
    assert.match(page, /reviewUnavailable = true/);
    assert.match(panel, /href="\/customers\/archive"/);
    assert.doesNotMatch(page, /service.role|supabase-admin|\.insert\(|\.update\(|\.delete\(|passport|phone|email/i);
  });
});
