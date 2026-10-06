export const MOBILE_TASK_PAGE_SIZE = 50;
export const MOBILE_GOOGLE_REDIRECT = "nobelcrm://auth";

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

export function publicAuthMessage(message: string, secret: string | readonly string[]) {
  const trimmed = message.trim();
  const secrets = typeof secret === "string" ? [secret] : secret;
  if (!trimmed || secrets.some((item) => item && trimmed.includes(item))) return "Giriş tamamlanamadı.";
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

export function cursorFilter(column: "due_at" | "updated_at" | "appointment_date", cursor: { dueAt: string; id: string }, direction: "asc" | "desc") {
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

const APPOINTMENT_STATUSES = new Set(["scheduled", "rescheduled", "cancelled", "no_show", "completed"]);
const APPLICATION_STATUS_LIST = [
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
] as const;

export type MobileAppointmentDto = {
  id: string;
  customerName: string;
  startsAt: string;
  location: string;
  country: string;
  visaType: string;
  appointmentStatus: string;
};

export function googleStartUrlAllowed(url: string, supabaseUrl: string) {
  try {
    const target = new URL(url);
    const supabase = new URL(supabaseUrl);
    return target.protocol === "https:" && target.host === supabase.host && target.username === "" && target.password === "";
  } catch {
    return false;
  }
}

export function isMobileTimestamp(value: string) {
  return DUE_AT.test(value);
}

export function mapMobileAppointment(row: {
  id: string;
  appointment_date: string | null;
  appointment_location: string | null;
  appointment_status: string | null;
  country: string;
  visa_type: string;
  customers: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
}): MobileAppointmentDto | null {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  if (!customer || !isUuid(row.id) || !row.appointment_date || !isMobileTimestamp(row.appointment_date)) return null;
  if (!row.appointment_status || !APPOINTMENT_STATUSES.has(row.appointment_status)) return null;
  const customerName = `${customer.first_name} ${customer.last_name}`.replace(/\s+/g, " ").trim();
  if (!customerName || !row.country || !row.visa_type) return null;
  return {
    id: row.id,
    customerName,
    startsAt: row.appointment_date,
    location: (row.appointment_location ?? "").slice(0, 200),
    country: row.country,
    visaType: row.visa_type,
    appointmentStatus: row.appointment_status,
  };
}

export function applicationStatusInput(body: unknown):
  | { ok: true; status: (typeof APPLICATION_STATUS_LIST)[number]; rejectionReason: string | null }
  | { ok: false; message: string } {
  if (bodySuppliesStaffId(body) || linksCustomer(body)) return { ok: false, message: "Personel kimliği istemciden alınmaz." };
  if (!body || typeof body !== "object") return { ok: false, message: "Başvuru bilgisi geçersiz." };
  const record = body as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : "";
  if (!APPLICATION_STATUS_LIST.includes(status as (typeof APPLICATION_STATUS_LIST)[number])) {
    return { ok: false, message: "Durum geçersiz." };
  }
  const reason = typeof record.rejectionReason === "string" ? record.rejectionReason.trim() : "";
  if (reason.length > 2000) return { ok: false, message: "Ret sebebi en fazla 2000 karakter olabilir." };
  if (status === "reddedildi" && reason.length === 0) return { ok: false, message: "Ret sebebi gereklidir." };
  return {
    ok: true,
    status: status as (typeof APPLICATION_STATUS_LIST)[number],
    rejectionReason: status === "reddedildi" ? reason : null,
  };
}

export function appointmentStatusInput(body: unknown):
  | { ok: true; status: "cancelled" | "no_show" | "completed"; note: string | null }
  | { ok: false; message: string } {
  if (bodySuppliesStaffId(body) || linksCustomer(body)) return { ok: false, message: "Personel kimliği istemciden alınmaz." };
  if (!body || typeof body !== "object") return { ok: false, message: "Randevu bilgisi geçersiz." };
  const record = body as Record<string, unknown>;
  const status = record.status;
  if (status !== "cancelled" && status !== "no_show" && status !== "completed") {
    return { ok: false, message: "Randevu durumu geçersiz." };
  }
  const note = typeof record.note === "string" ? record.note.trim() : "";
  if (note.length > 1000) return { ok: false, message: "Not en fazla 1000 karakter olabilir." };
  return { ok: true, status, note: note || null };
}

export function taskCreateInput(body: unknown):
  | { ok: true; payload: { title: string; description: string | null; due_at: string; priority: "low" | "normal" | "high" } }
  | { ok: false; message: string } {
  if (bodySuppliesStaffId(body) || linksCustomer(body)) return { ok: false, message: "Görev bu ekrandan başkasına bağlanmaz." };
  if (!body || typeof body !== "object") return { ok: false, message: "Görev bilgisi geçersiz." };
  const record = body as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (title.length < 1 || title.length > 200) return { ok: false, message: "Başlık 1-200 karakter olmalı." };
  const detail = typeof record.detail === "string" ? record.detail.trim() : "";
  if (detail.length > 2000) return { ok: false, message: "Açıklama en fazla 2000 karakter olabilir." };
  const dueAt = typeof record.dueAt === "string" ? record.dueAt : "";
  if (!isMobileTimestamp(dueAt)) return { ok: false, message: "Son tarih geçersiz." };
  const priority = record.priority === "low" || record.priority === "high" ? record.priority : "normal";
  return { ok: true, payload: { title, description: detail || null, due_at: dueAt, priority } };
}

function linksCustomer(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return "customer_id" in record || "customerId" in record || "application_id" in record || "applicationId" in record;
}
