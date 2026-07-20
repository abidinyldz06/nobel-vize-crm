export const CLOSED_APPLICATION_STATUSES = ["onaylandi", "reddedildi", "kapandi"] as const;
export const COMPLETED_DOCUMENT_STATUS = "onaylandi";

export type DateRange = {
  start: Date;
  end: Date;
};

type Timestamped = {
  created_at: string;
};

type ApplicationMetric = Timestamped & {
  status: string;
  total_fee?: number | null;
  updated_at?: string | null;
};

type PaymentMetric = Timestamped & {
  amount: number | null;
  status: string | null;
};

type DocumentMetric = {
  status: string;
};

export function normalizeReportPeriod(
  monthValue: string | undefined,
  yearValue: string | undefined,
  now = new Date(),
) {
  const parsedMonth = Number(monthValue);
  const parsedYear = Number(yearValue);
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth
    : now.getUTCMonth() + 1;
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
    ? parsedYear
    : now.getUTCFullYear();

  return {
    month,
    year,
    monthParam: String(month).padStart(2, "0"),
    yearParam: String(year),
  };
}

export function monthRangeUtc(year: number, month: number): DateRange {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function shiftMonthRange(range: DateRange, offset: number): DateRange {
  return {
    start: new Date(Date.UTC(
      range.start.getUTCFullYear(),
      range.start.getUTCMonth() + offset,
      1,
    )),
    end: new Date(Date.UTC(
      range.end.getUTCFullYear(),
      range.end.getUTCMonth() + offset,
      1,
    )),
  };
}

export function isInRange(timestamp: string, range: DateRange) {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) && value >= range.start.getTime() && value < range.end.getTime();
}

export function filterByRange<T extends Timestamped>(items: readonly T[], range: DateRange) {
  return items.filter((item) => isInRange(item.created_at, range));
}

export function countActiveApplications(applications: readonly Pick<ApplicationMetric, "status">[]) {
  return applications.filter(
    (application) => !CLOSED_APPLICATION_STATUSES.includes(
      application.status as (typeof CLOSED_APPLICATION_STATUSES)[number],
    ),
  ).length;
}

export function sumExpectedRevenue(applications: readonly Pick<ApplicationMetric, "total_fee">[]) {
  return applications.reduce((total, application) => total + Number(application.total_fee ?? 0), 0);
}

export function sumPayments(
  payments: readonly Pick<PaymentMetric, "amount" | "status">[],
  status: "alindi" | "bekliyor",
) {
  return payments
    .filter((payment) => payment.status === status)
    .reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
}

export function summarizeApplications(applications: readonly ApplicationMetric[]) {
  const approved = applications.filter((application) => application.status === "onaylandi").length;
  const rejected = applications.filter((application) => application.status === "reddedildi").length;

  return {
    total: applications.length,
    approved,
    rejected,
    approvalRate: applications.length > 0 ? (approved / applications.length) * 100 : null,
    expectedRevenue: sumExpectedRevenue(applications),
  };
}

export function summarizeDocuments(documents: readonly DocumentMetric[]) {
  const completed = documents.filter((document) => document.status === COMPLETED_DOCUMENT_STATUS).length;
  const pending = documents.filter((document) => document.status === "bekleniyor").length;

  return {
    total: documents.length,
    completed,
    pending,
    completionRate: documents.length > 0 ? (completed / documents.length) * 100 : 0,
  };
}

export function averageProcessDays(applications: readonly ApplicationMetric[], fallback = 30) {
  const durations = applications.flatMap((application) => {
    if (!application.updated_at || !["onaylandi", "reddedildi"].includes(application.status)) {
      return [];
    }

    const duration = Date.parse(application.updated_at) - Date.parse(application.created_at);
    return Number.isFinite(duration) && duration > 0 ? [duration] : [];
  });

  if (durations.length === 0) return fallback;
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return Math.round(total / durations.length / (1000 * 60 * 60 * 24));
}
