import assert from "node:assert/strict";
import test from "node:test";

import {
  averageProcessDays,
  countActiveApplications,
  filterByRange,
  monthRangeUtc,
  normalizeReportPeriod,
  shiftMonthRange,
  sumPayments,
  summarizeApplications,
  summarizeDocuments,
} from "../src/lib/report-metrics.ts";

test("report period rejects invalid query values and uses the UTC current period", () => {
  const now = new Date("2026-07-20T21:30:00.000Z");

  assert.deepEqual(normalizeReportPeriod("13", "abc", now), {
    month: 7,
    year: 2026,
    monthParam: "07",
    yearParam: "2026",
  });
});

test("month ranges use inclusive start and exclusive end boundaries", () => {
  const range = monthRangeUtc(2026, 2);
  const rows = [
    { created_at: "2026-01-31T23:59:59.999Z" },
    { created_at: "2026-02-01T00:00:00.000Z" },
    { created_at: "2026-02-28T23:59:59.999Z" },
    { created_at: "2026-03-01T00:00:00.000Z" },
  ];

  assert.deepEqual(filterByRange(rows, range), rows.slice(1, 3));
  assert.equal(shiftMonthRange(range, -1).start.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("application totals are calculated from the complete supplied data set", () => {
  const applications = [
    { created_at: "2026-01-01T00:00:00Z", status: "profil_analizi", total_fee: 100 },
    { created_at: "2026-01-02T00:00:00Z", status: "onaylandi", total_fee: 200 },
    { created_at: "2026-01-03T00:00:00Z", status: "reddedildi", total_fee: 300 },
    { created_at: "2026-01-04T00:00:00Z", status: "kapandi", total_fee: null },
  ];

  assert.equal(countActiveApplications(applications), 1);
  assert.deepEqual(summarizeApplications(applications), {
    total: 4,
    approved: 1,
    rejected: 1,
    approvalRate: 25,
    expectedRevenue: 600,
  });
});

test("document completion uses the canonical onaylandi status", () => {
  const summary = summarizeDocuments([
    { status: "onaylandi" },
    { status: "bekleniyor" },
    { status: "tamamlandi" },
  ]);

  assert.deepEqual(
    { total: summary.total, completed: summary.completed, pending: summary.pending },
    { total: 3, completed: 1, pending: 1 },
  );
  assert.ok(Math.abs(summary.completionRate - (100 / 3)) < Number.EPSILON * 100);
});

test("payment and processing metrics ignore unrelated statuses and invalid durations", () => {
  assert.equal(
    sumPayments([
      { amount: 120, status: "alindi" },
      { amount: 30, status: "bekliyor" },
      { amount: null, status: "alindi" },
    ], "alindi"),
    120,
  );

  assert.equal(averageProcessDays([
    {
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-11T00:00:00Z",
      status: "onaylandi",
    },
    {
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      status: "reddedildi",
    },
  ]), 10);
});
