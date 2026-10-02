import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { summarizeDataQuality, type QualityCustomer, type QualityApplication, type QualityDataset, type QualityTask } from "../src/lib/data-quality-summary";
import { readAllPages } from "../src/lib/read-all-pages";

const now = new Date("2026-10-02T08:00:00Z");
const customer = (override: Partial<QualityCustomer> = {}): QualityCustomer => ({
  id: "customer-test", is_deleted: false, phone: "05550000000", email: "test@example.test",
  passport_no: "TEST-ONLY", passport_expiry: "2028-01-01", assigned_staff_id: "active-staff", ...override,
});
const application = (override: Partial<QualityApplication> = {}): QualityApplication => ({
  id: "application-test", customer_id: "customer-test", status: "profil_analizi", country_id: "country-test", country: "Test ülke",
  visa_type: "turistik", assigned_staff_id: "active-staff", travel_method: "ucak", accommodation: "otel",
  occupation: "calisan", with_children: false, nationality: "TR", ...override,
});
const task = (override: Partial<QualityTask> = {}): QualityTask => ({
  idempotency_key: "data-quality:customer:customer-test:passport-no", status: "pending", due_at: "2026-10-01T08:00:00Z",
  assigned_staff_id: "active-staff", completed_at: null, ...override,
});
const dataset = (override: Partial<QualityDataset> = {}): QualityDataset => ({
  customers: [customer()], applications: [application()], tasks: [], staff: [{ id: "active-staff", is_active: true }], ...override,
});

describe("read-only data quality summary", () => {
  it("distinguishes zero active applications from a successful operational sample", () => {
    const result = summarizeDataQuality(dataset({ applications: [] }), now);
    assert.equal(result.insufficientSample, true);
    assert.equal(result.missingFields, 0);
    assert.equal(result.activeCustomers, 1);
    assert.equal(result.measuredAt, now.toISOString());
  });

  it("matches all seven missing-field rules and does not double count customer passports", () => {
    const result = summarizeDataQuality(dataset({
      customers: [customer({ phone: " + () ", email: " ", passport_no: " ", passport_expiry: null, assigned_staff_id: null })],
      applications: [application({ country_id: null, visa_type: " ", assigned_staff_id: null, with_children: null }), application({ id: "second", country: " ", visa_type: " ", assigned_staff_id: null, occupation: null })],
    }), now);
    assert.equal(result.missingFields, 11);
    assert.deepEqual(result.categories.map(row => row.missing), [1, 1, 1, 2, 2, 2, 2]);
  });

  it("accepts either contact channel, false children and active customer owner fallback", () => {
    const result = summarizeDataQuality(dataset({ customers: [customer({ email: null })], applications: [application({ assigned_staff_id: "inactive" })] }), now);
    assert.equal(result.missingFields, 0);
    assert.equal(result.insufficientSample, false);
  });

  it("excludes archived and closed applications from active quality but warns about archived open ones", () => {
    const result = summarizeDataQuality(dataset({ customers: [customer({ is_deleted: true, phone: null, email: null })], applications: [application(), application({ id: "closed", status: "kapandi" })] }), now);
    assert.equal(result.archivedOpenApplications, 1);
    assert.equal(result.openApplications, 0);
    assert.equal(result.missingFields, 0);
  });

  it("counts archived applications when customer RLS hides their rows", () => {
    const result = summarizeDataQuality(dataset({ customers: [], archivedCustomerIds: ["customer-test"] }), now);
    assert.equal(result.archivedOpenApplications, 1);
    assert.equal(result.openApplications, 0);
  });

  it("keeps queued, suppressed, completed-but-missing and never-queued results distinct", () => {
    const customers = Array.from({ length: 4 }, (_, index) => customer({ id: `c${index}`, passport_no: null }));
    const applications = customers.map(c => application({ id: `a${c.id}`, customer_id: c.id }));
    const tasks = ["pending", "completed", "cancelled"].map((status, index) => task({ idempotency_key: `data-quality:customer:c${index}:passport-no`, status }));
    const result = summarizeDataQuality(dataset({ customers, applications, tasks }), now);
    assert.deepEqual(result.categories[1], { key: "passport-no", label: "Pasaport numarası", days: 3, missing: 4, queued: 1, neverQueued: 1, completedStillMissing: 1, suppressed: 1 });
  });

  it("counts exact deadline, stale tasks, inactive owner and a bounded rolling seven-day completion window", () => {
    const result = summarizeDataQuality(dataset({ tasks: [
      task({ assigned_staff_id: "inactive" }), task({ idempotency_key: "other", due_at: now.toISOString() }),
      task({ status: "completed", completed_at: "2026-09-25T08:00:00Z" }),
      task({ status: "completed", completed_at: "2026-09-25T07:59:59Z" }),
      task({ status: "completed", completed_at: "2026-10-03T08:00:00Z" }),
    ] }), now);
    assert.deepEqual(result.queue, { open: 2, overdue: 1, inactiveOwner: 1, stale: 2, completedLast7Days: 1 });
  });

  it("returns aggregates only and does not mutate records", () => {
    const input = dataset();
    const original = structuredClone(input);
    const output = JSON.stringify(summarizeDataQuality(input, now));
    for (const secret of ["customer-test", "application-test", "active-staff", "test@example.test", "05550000000", "TEST-ONLY"]) assert.ok(!output.includes(secret));
    assert.deepEqual(input, original);
  });
});

describe("complete paginated reads", () => {
  it("reads more than 250/1000 rows even when the API returns fewer than the requested page size", async () => {
    const input = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const result = await readAllPages(async (from, to) => ({ data: input.slice(from, Math.min(to + 1, from + 100)), count: input.length, error: null }));
    assert.deepEqual(result, input);
  });
  it("handles a genuinely empty dataset", async () => {
    assert.deepEqual(await readAllPages(async () => ({ data: [], error: null, count: 0 })), []);
  });
  it("rejects error, incomplete page, changing counts and datasets beyond the safe bound", async () => {
    for (const page of [
      { data: [], error: new Error("private database detail"), count: 0 },
      { data: [], error: null, count: 1 }, { data: [], error: null, count: null }, { data: [], error: null, count: 25001 },
    ]) await assert.rejects(readAllPages(async () => page), /quality_read_incomplete/);
    let calls = 0;
    await assert.rejects(readAllPages(async () => ({ data: [{ id: ++calls }], count: calls === 1 ? 2 : 3, error: null })), /quality_read_incomplete/);
  });
});

describe("quality access and mutation boundaries", () => {
  it("uses admin/MFA authorization, the session RLS client, only the read-only archive RPC and private uncached responses", async () => {
    const route = await readFile(new URL("../src/app/api/tasks/data-quality/route.ts", import.meta.url), "utf8");
    const reader = await readFile(new URL("../src/lib/data-quality-reader.ts", import.meta.url), "utf8");
    assert.match(route, /await requireAdmin\(\)/);
    assert.match(route, /readDataQualitySummary\(context\.supabase\)/);
    assert.match(route, /private, no-store/);
    assert.match(route, /status: 503/);
    assert.match(reader, /import "server-only"/);
    assert.equal((reader.match(/\.rpc\(/g) ?? []).length, 1);
    assert.match(reader, /\.rpc\("list_archived_customers_v1"/);
    assert.doesNotMatch(route + reader, /\.insert\(|\.update\(|\.delete\(|service.role|supabase-admin|sync_data_quality_tasks|sync_operational_tasks/i);
    const board = await readFile(new URL("../src/components/TaskBoard.tsx", import.meta.url), "utf8");
    assert.match(board, /isAdmin && <DataQualityPanel/);
  });
});
