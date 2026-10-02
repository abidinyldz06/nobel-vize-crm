import type { Database } from "../types/database";
import { isOpenApplicationStatus } from "./application-status";

type Row<Table extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Table]["Row"];
export type QualityCustomer = Pick<Row<"customers">, "id" | "is_deleted" | "phone" | "email" | "passport_no" | "passport_expiry" | "assigned_staff_id">;
export type QualityApplication = Pick<Row<"applications">, "id" | "customer_id" | "status" | "country_id" | "country" | "visa_type" | "assigned_staff_id" | "travel_method" | "accommodation" | "occupation" | "with_children" | "nationality">;
export type QualityTask = Pick<Row<"tasks">, "idempotency_key" | "status" | "due_at" | "assigned_staff_id" | "completed_at">;
export type QualityDataset = {
  customers: QualityCustomer[];
  applications: QualityApplication[];
  tasks: QualityTask[];
  staff: Array<{ id: string; is_active: boolean }>;
  archivedCustomerIds?: string[];
};

const categories = [
  { key: "contact", label: "İletişim kanalı", days: 3 },
  { key: "passport-no", label: "Pasaport numarası", days: 3 },
  { key: "passport-expiry", label: "Pasaport bitiş tarihi", days: 3 },
  { key: "country", label: "Başvuru ülkesi", days: 3 },
  { key: "visa-type", label: "Vize türü", days: 3 },
  { key: "assignee", label: "Aktif sorumlu", days: 1 },
  { key: "profile", label: "Başvuru profili", days: 7 },
] as const;
type Category = typeof categories[number]["key"];
const isOpenTask = (task: QualityTask) => task.status === "pending" || task.status === "in_progress";
const isBlank = (value: string | null) => !value?.trim();

// Mirrors the existing seven sync rules without calling any mutating RPC.
// Only aggregates are returned; record IDs and personal fields stay on the server.
export function summarizeDataQuality(dataset: QualityDataset, now = new Date()) {
  const customers = new Map(dataset.customers.map(customer => [customer.id, customer]));
  const activeCustomers = dataset.customers.filter(customer => customer.is_deleted === false);
  const archivedCustomers = new Set(dataset.archivedCustomerIds ?? dataset.customers.filter(customer => customer.is_deleted === true).map(customer => customer.id));
  const activeStaff = new Set(dataset.staff.filter(staff => staff.is_active).map(staff => staff.id));
  const openApplications = dataset.applications.filter(application =>
    isOpenApplicationStatus(application.status) && customers.get(application.customer_id)?.is_deleted === false
  );
  const applicants = new Set(openApplications.map(application => application.customer_id));
  const findings = new Map<string, Category>();
  const add = (entity: "customer" | "application", id: string, category: Category) =>
    findings.set(`data-quality:${entity}:${id}:${category}`, category);

  for (const customer of activeCustomers) {
    if (!customer.phone?.replace(/[^0-9]/g, "") && isBlank(customer.email)) add("customer", customer.id, "contact");
    if (applicants.has(customer.id)) {
      if (isBlank(customer.passport_no)) add("customer", customer.id, "passport-no");
      if (customer.passport_expiry === null) add("customer", customer.id, "passport-expiry");
    }
  }
  for (const application of openApplications) {
    const customer = customers.get(application.customer_id)!;
    if (!application.country_id || isBlank(application.country)) add("application", application.id, "country");
    if (isBlank(application.visa_type)) add("application", application.id, "visa-type");
    if (!activeStaff.has(application.assigned_staff_id ?? "") && !activeStaff.has(customer.assigned_staff_id ?? "")) {
      add("application", application.id, "assignee");
    }
    if ([application.travel_method, application.accommodation, application.occupation, application.nationality].some(isBlank)
      || application.with_children === null) add("application", application.id, "profile");
  }

  const tasksByKey = new Map(dataset.tasks.filter(task => task.idempotency_key).map(task => [task.idempotency_key!, task]));
  const rows = categories.map(category => {
    const keys = [...findings].filter(([, value]) => value === category.key).map(([key]) => key);
    return {
      ...category,
      missing: keys.length,
      queued: keys.filter(key => { const task = tasksByKey.get(key); return task && isOpenTask(task); }).length,
      neverQueued: keys.filter(key => !tasksByKey.has(key)).length,
      completedStillMissing: keys.filter(key => tasksByKey.get(key)?.status === "completed").length,
      suppressed: keys.filter(key => tasksByKey.get(key)?.status === "cancelled").length,
    };
  });
  const openTasks = dataset.tasks.filter(isOpenTask);
  return {
    measuredAt: now.toISOString(),
    activeCustomers: activeCustomers.length,
    openApplications: openApplications.length,
    archivedOpenApplications: dataset.applications.filter(application =>
      isOpenApplicationStatus(application.status) && archivedCustomers.has(application.customer_id)
    ).length,
    insufficientSample: openApplications.length === 0,
    missingFields: findings.size,
    categories: rows,
    queue: {
      open: openTasks.length,
      overdue: openTasks.filter(task => Date.parse(task.due_at) < now.getTime()).length,
      inactiveOwner: openTasks.filter(task => !activeStaff.has(task.assigned_staff_id)).length,
      stale: openTasks.filter(task => !task.idempotency_key || !findings.has(task.idempotency_key)).length,
      completedLast7Days: dataset.tasks.filter(task => task.status === "completed" && task.completed_at
        && Date.parse(task.completed_at) >= now.getTime() - 7 * 86_400_000
        && Date.parse(task.completed_at) <= now.getTime()).length,
    },
  };
}

export type DataQualitySummary = ReturnType<typeof summarizeDataQuality>;
