export const MOBILE_TASK_PAGE_SIZE = 50;

const DUE_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MobileRole = "admin" | "consultant";

export type MobileStaffDto = {
  fullName: string;
  role: MobileRole;
};

export type MobileTaskDto = {
  id: string;
  title: string;
  detail: string;
  dueAt: string;
  priority: "low" | "normal" | "high";
  status: "open" | "completed";
};

export function mobileMfaRequired(
  role: MobileRole,
  company: { admin_mfa_required: boolean | null; consultant_mfa_required: boolean | null },
) {
  if (role === "admin") return company.admin_mfa_required !== false;
  return company.consultant_mfa_required === true;
}

export function assuranceFromAccessToken(accessToken: string): "aal1" | "aal2" | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { aal?: unknown };
    return json.aal === "aal1" || json.aal === "aal2" ? json.aal : null;
  } catch {
    return null;
  }
}

export function publicAuthMessage(message: string, secret: string) {
  const trimmed = message.trim();
  if (!trimmed || (secret && trimmed.includes(secret))) return "Giriş tamamlanamadı.";
  return trimmed.slice(0, 200);
}

export function clientSuppliedStaffId(url: URL) {
  return url.searchParams.has("staff_id") || url.searchParams.has("staffId");
}

export function mapMobileTask(row: {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  priority: string;
  status: string;
}): MobileTaskDto | null {
  const priority = row.priority === "urgent" ? "high" : row.priority;
  if (priority !== "low" && priority !== "normal" && priority !== "high") return null;
  const status = row.status === "completed"
    ? "completed"
    : row.status === "pending" || row.status === "in_progress"
      ? "open"
      : null;
  if (!status || !row.id || !row.title || !row.due_at) return null;
  return {
    id: row.id,
    title: row.title,
    detail: (row.description ?? "").slice(0, 2000),
    dueAt: row.due_at,
    priority,
    status,
  };
}

export function encodeTaskCursor(dueAt: string, id: string) {
  return Buffer.from(`${dueAt}\n${id}`, "utf8").toString("base64url");
}

export function decodeTaskCursor(cursor: string): { dueAt: string; id: string } | null {
  try {
    const [dueAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("\n");
    if (!dueAt || !id || !DUE_AT.test(dueAt) || !UUID.test(id)) return null;
    return { dueAt, id };
  } catch {
    return null;
  }
}

export function isUuid(value: string) {
  return UUID.test(value);
}

export function quoteFilter(value: string) {
  return `"${value.replaceAll('"', "")}"`;
}

export function cursorFilter(column: "due_at" | "updated_at", cursor: { dueAt: string; id: string }, direction: "asc" | "desc") {
  const at = quoteFilter(cursor.dueAt);
  const id = quoteFilter(cursor.id);
  const compare = direction === "asc" ? "gt" : "lt";
  return `${column}.${compare}.${at},and(${column}.eq.${at},id.${compare}.${id})`;
}

const APPLICATION_STATUSES = new Set([
  "profil_analizi",
  "evrak_bekleniyor",
  "randevu_bekleniyor",
  "randevu_alindi",
  "evrak_hazirlaniyor",
  "basvuru_yapildi",
  "onaylandi",
  "reddedildi",
  "itiraz",
  "kapandi",
]);

export type MobileCustomerDto = { id: string; fullName: string };
export type MobileApplicationDto = {
  id: string;
  customerName: string;
  country: string;
  visaType: string;
  status: string;
};

export function mapMobileCustomer(row: { id: string; first_name: string; last_name: string }): MobileCustomerDto | null {
  const fullName = `${row.first_name} ${row.last_name}`.replace(/\s+/g, " ").trim();
  if (!isUuid(row.id) || !fullName) return null;
  return { id: row.id, fullName };
}

export function mapMobileApplication(row: {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  customers: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}): MobileApplicationDto | null {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  if (!customer || !isUuid(row.id) || !APPLICATION_STATUSES.has(row.status)) return null;
  const customerName = `${customer.first_name} ${customer.last_name}`.replace(/\s+/g, " ").trim();
  if (!customerName || !row.country || !row.visa_type) return null;
  return { id: row.id, customerName, country: row.country, visaType: row.visa_type, status: row.status };
}

export function bodySuppliesStaffId(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return "staff_id" in record || "staffId" in record || "assigned_staff_id" in record;
}
