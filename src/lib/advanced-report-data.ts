import "server-only";

import { requireStaff } from "@/lib/authz";
import { monthRangeUtc, normalizeReportPeriod } from "@/lib/report-metrics";
import { summarizeLeadSla, summarizePaymentAging } from "@/lib/advanced-report-metrics";

type ApplicationRow = {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string;
  assigned_staff_id: string | null;
};

export type AdvancedReport = {
  period: { month: number; year: number; label: string };
  resultRows: Array<{ country: string; visaType: string; approved: number; rejected: number; pending: number }>;
  aging: Array<{ label: string; count: number; amount: number }>;
  leadSla: { open: number; overdue: number; dueSoon: number };
  workload: Array<{ staff: string; applications: number; leads: number; tasks: number }>;
};

export async function loadAdvancedReport(month?: string, year?: string, now = new Date()): Promise<AdvancedReport> {
  const { supabase } = await requireStaff();
  const period = normalizeReportPeriod(month, year, now);
  const range = monthRangeUtc(period.year, period.month);
  const [{ data: applications }, { data: payments }, { data: leads }, { data: tasks }, { data: staff }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, country, visa_type, status, created_at, assigned_staff_id, customers!inner(is_deleted)")
      .eq("customers.is_deleted", false),
    supabase.from("payments").select("amount, status, created_at"),
    supabase.from("leads").select("status, follow_up_due_at, assigned_staff_id"),
    supabase.from("tasks").select("status, assigned_staff_id"),
    supabase.from("staff").select("id, full_name").eq("is_active", true),
  ]);

  const periodApplications = ((applications ?? []) as ApplicationRow[]).filter((application) => {
    const created = new Date(application.created_at);
    return created >= range.start && created < range.end;
  });
  const resultMap = new Map<string, AdvancedReport["resultRows"][number]>();
  for (const application of periodApplications) {
    const key = `${application.country}\u0000${application.visa_type}`;
    const item = resultMap.get(key) ?? {
      country: application.country,
      visaType: application.visa_type,
      approved: 0,
      rejected: 0,
      pending: 0,
    };
    if (application.status === "onaylandi") item.approved += 1;
    else if (application.status === "reddedildi") item.rejected += 1;
    else item.pending += 1;
    resultMap.set(key, item);
  }

  const activeLeadRows = (leads ?? []).filter((lead) => !["converted", "lost", "unqualified"].includes(lead.status));
  const leadSla = summarizeLeadSla(leads ?? [], now);

  const workloadMap = new Map<string, AdvancedReport["workload"][number]>();
  for (const member of staff ?? []) {
    workloadMap.set(member.id, { staff: member.full_name, applications: 0, leads: 0, tasks: 0 });
  }
  for (const application of applications ?? []) {
    if (["onaylandi", "reddedildi", "kapandi"].includes(application.status) || !application.assigned_staff_id) continue;
    const item = workloadMap.get(application.assigned_staff_id);
    if (item) item.applications += 1;
  }
  for (const lead of activeLeadRows) {
    const item = workloadMap.get(lead.assigned_staff_id);
    if (item) item.leads += 1;
  }
  for (const task of tasks ?? []) {
    if (task.status === "completed") continue;
    const item = workloadMap.get(task.assigned_staff_id);
    if (item) item.tasks += 1;
  }

  return {
    period: {
      ...period,
      label: new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(period.year, period.month - 1, 1))),
    },
    resultRows: [...resultMap.values()].sort((a, b) => (b.approved + b.rejected + b.pending) - (a.approved + a.rejected + a.pending)),
    aging: summarizePaymentAging(payments ?? [], now),
    leadSla,
    workload: [...workloadMap.values()].sort((a, b) =>
      (b.applications + b.leads + b.tasks) - (a.applications + a.leads + a.tasks)),
  };
}

export function advancedReportCsv(report: AdvancedReport) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows: Array<Array<string | number>> = [
    ["Rapor", report.period.label],
    [],
    ["Ülke", "Vize Türü", "Onay", "Red", "Bekleyen"],
    ...report.resultRows.map((row) => [row.country, row.visaType, row.approved, row.rejected, row.pending]),
    [],
    ["Bekleyen Tahsilat Yaşı", "Adet", "Tutar"],
    ...report.aging.map((row) => [row.label, row.count, row.amount]),
    [],
    ["Danışman", "Aktif Başvuru", "Aktif Lead", "Açık Görev"],
    ...report.workload.map((row) => [row.staff, row.applications, row.leads, row.tasks]),
    [],
    ["Lead SLA", "Değer"],
    ["Açık", report.leadSla.open],
    ["Geciken", report.leadSla.overdue],
    ["24 saat içinde", report.leadSla.dueSoon],
  ];
  return `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}\r\n`;
}
