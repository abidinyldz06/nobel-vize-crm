import "server-only";

import type { Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { decryptCalendarToken, encryptCalendarToken, parseCalendarTokenEncryptionKey } from "@/lib/calendar-token-crypto";
import { getGoogleCalendarConfig, refreshGoogleCalendarAccessToken } from "@/lib/google-calendar-oauth";

type CalendarConnection = Tables<"calendar_connections">;
type CalendarLink = Tables<"calendar_event_links">;

type CrmCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  assigned_staff_id: string | null;
  is_deleted: boolean;
};

type CrmAppointment = {
  id: string;
  customer_id: string;
  country: string;
  visa_type: string;
  status: string;
  assigned_staff_id: string | null;
  appointment_date: string;
  appointment_location: string | null;
  appointment_status: string | null;
  appointment_duration_minutes: number;
  customers: CrmCustomer;
};

type GoogleCalendarEvent = {
  id?: string;
  etag?: string;
  status?: string;
  updated?: string;
  location?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};

type GoogleCalendarEventPage = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

export type CalendarSyncResult = {
  staffId: string;
  exported: number;
  imported: number;
  cancelled: number;
};

class GoogleCalendarApiError extends Error {
  constructor(
    public readonly status: number,
    code: string,
  ) {
    super(code);
    this.name = "GoogleCalendarApiError";
    this.code = code;
  }

  readonly code: string;
}

function googleCalendarApiUrl(calendarId: string, suffix: string, params?: URLSearchParams) {
  const encodedCalendar = encodeURIComponent(calendarId);
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodedCalendar}/${suffix}`);
  if (params) url.search = params.toString();
  return url.toString();
}

async function googleCalendarRequest<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
  fetchImpl = fetch,
) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new GoogleCalendarApiError(response.status, `google_calendar_api_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

function connectionErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code.slice(0, 240);
  }
  return "google_calendar_sync_failed";
}

function appointmentFromRow(row: unknown): CrmAppointment | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const customerValue = record.customers;
  const customer = Array.isArray(customerValue) ? customerValue[0] : customerValue;
  if (!customer || typeof customer !== "object" || typeof record.appointment_date !== "string") return null;
  const parsed = {
    id: record.id,
    customer_id: record.customer_id,
    country: record.country,
    visa_type: record.visa_type,
    status: record.status,
    assigned_staff_id: record.assigned_staff_id,
    appointment_date: record.appointment_date,
    appointment_location: record.appointment_location,
    appointment_status: record.appointment_status,
    appointment_duration_minutes: record.appointment_duration_minutes,
    customers: customer,
  } as CrmAppointment;
  if (
    typeof parsed.id !== "string" || typeof parsed.customer_id !== "string"
    || typeof parsed.country !== "string" || typeof parsed.visa_type !== "string"
    || typeof parsed.appointment_duration_minutes !== "number"
    || typeof parsed.customers.id !== "string" || parsed.customers.is_deleted
  ) return null;
  return parsed;
}

async function activeAppointmentsForStaff(staffId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select("id, customer_id, country, visa_type, status, assigned_staff_id, appointment_date, appointment_location, appointment_status, appointment_duration_minutes, customers!inner(id, first_name, last_name, assigned_staff_id, is_deleted)")
    .not("appointment_date", "is", null)
    .eq("customers.is_deleted", false);
  if (error) throw error;
  return (data || [])
    .map(appointmentFromRow)
    .filter((appointment): appointment is CrmAppointment => Boolean(appointment))
    .filter(appointment => (appointment.assigned_staff_id ?? appointment.customers.assigned_staff_id) === staffId);
}

async function getFreshAccessToken(connection: CalendarConnection) {
  const key = parseCalendarTokenEncryptionKey(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY);
  const now = Date.now();
  const expiresAt = new Date(connection.access_token_expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > now + 5 * 60_000) {
    return decryptCalendarToken(connection.access_token_ciphertext, key);
  }

  const config = getGoogleCalendarConfig();
  const refreshToken = await decryptCalendarToken(connection.refresh_token_ciphertext, key);
  const refreshed = await refreshGoogleCalendarAccessToken(refreshToken, config);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("calendar_connections")
    .update({
      access_token_ciphertext: await encryptCalendarToken(refreshed.accessToken, key),
      refresh_token_ciphertext: refreshed.refreshToken
        ? await encryptCalendarToken(refreshed.refreshToken, key)
        : connection.refresh_token_ciphertext,
      access_token_expires_at: refreshed.expiresAt.toISOString(),
      last_sync_error: null,
    })
    .eq("id", connection.id);
  if (error) throw error;
  return refreshed.accessToken;
}

function eventPayload(appointment: CrmAppointment, connectionId: string) {
  const start = new Date(appointment.appointment_date);
  const end = new Date(start.getTime() + appointment.appointment_duration_minutes * 60_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw Object.assign(new Error("calendar_appointment_date_invalid"), { code: "calendar_appointment_date_invalid" });
  }
  return {
    summary: `${appointment.customers.first_name} ${appointment.customers.last_name} — ${appointment.country} vize randevusu`,
    description: `${appointment.visa_type} başvurusu. CRM başvuru no: ${appointment.id}`,
    location: appointment.appointment_location ?? "",
    start: { dateTime: start.toISOString(), timeZone: "Europe/Istanbul" },
    end: { dateTime: end.toISOString(), timeZone: "Europe/Istanbul" },
    extendedProperties: {
      private: {
        nobel_application_id: appointment.id,
        nobel_connection_id: connectionId,
      },
    },
  };
}

async function saveEventLink(
  connectionId: string,
  applicationId: string,
  event: GoogleCalendarEvent,
  remoteDeletedAt: string | null = null,
) {
  if (!event.id) throw Object.assign(new Error("google_calendar_event_id_missing"), { code: "google_calendar_event_id_missing" });
  const { error } = await createSupabaseAdminClient()
    .from("calendar_event_links")
    .upsert({
      connection_id: connectionId,
      application_id: applicationId,
      google_event_id: event.id,
      google_event_etag: event.etag ?? null,
      remote_updated_at: event.updated ?? null,
      remote_deleted_at: remoteDeletedAt,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "connection_id,application_id" });
  if (error) throw error;
}

async function exportAppointments(
  connection: CalendarConnection,
  accessToken: string,
  appointments: CrmAppointment[],
  links: CalendarLink[],
) {
  const linksByApplication = new Map(links.map(link => [link.application_id, link]));
  let exported = 0;
  for (const appointment of appointments) {
    const link = linksByApplication.get(appointment.id);
    if (appointment.appointment_status === "cancelled") {
      if (link && !link.remote_deleted_at) {
        try {
          await googleCalendarRequest<void>(
            googleCalendarApiUrl(connection.calendar_id, `events/${encodeURIComponent(link.google_event_id)}`),
            accessToken,
            { method: "DELETE" },
          );
        } catch (error) {
          if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) throw error;
        }
        await saveEventLink(connection.id, appointment.id, {
          id: link.google_event_id,
          etag: link.google_event_etag ?? undefined,
          updated: new Date().toISOString(),
        }, new Date().toISOString());
        exported += 1;
      }
      continue;
    }

    const payload = eventPayload(appointment, connection.id);
    let event: GoogleCalendarEvent;
    if (link && !link.remote_deleted_at) {
      try {
        event = await googleCalendarRequest<GoogleCalendarEvent>(
          googleCalendarApiUrl(connection.calendar_id, `events/${encodeURIComponent(link.google_event_id)}`),
          accessToken,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) throw error;
        event = await googleCalendarRequest<GoogleCalendarEvent>(
          googleCalendarApiUrl(connection.calendar_id, "events"),
          accessToken,
          { method: "POST", body: JSON.stringify(payload) },
        );
      }
    } else {
      event = await googleCalendarRequest<GoogleCalendarEvent>(
        googleCalendarApiUrl(connection.calendar_id, "events"),
        accessToken,
        { method: "POST", body: JSON.stringify(payload) },
      );
    }
    await saveEventLink(connection.id, appointment.id, event);
    exported += 1;
  }
  return exported;
}

async function readCalendarChanges(connection: CalendarConnection, accessToken: string) {
  const all: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const read = async (syncToken?: string) => {
    do {
      const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "2500" });
      if (syncToken) params.set("syncToken", syncToken);
      else params.set("timeMin", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString());
      if (pageToken) params.set("pageToken", pageToken);
      const page = await googleCalendarRequest<GoogleCalendarEventPage>(
        googleCalendarApiUrl(connection.calendar_id, "events", params),
        accessToken,
      );
      all.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  };

  try {
    await read(connection.sync_token ?? undefined);
  } catch (error) {
    if (!(error instanceof GoogleCalendarApiError) || error.status !== 410 || !connection.sync_token) throw error;
    pageToken = undefined;
    all.length = 0;
    nextSyncToken = undefined;
    await read();
  }
  return { events: all, nextSyncToken };
}

function asRemoteDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function importCalendarChanges(
  connection: CalendarConnection,
  appointments: CrmAppointment[],
  links: CalendarLink[],
  events: GoogleCalendarEvent[],
) {
  const appointmentById = new Map(appointments.map(appointment => [appointment.id, appointment]));
  const linkByEventId = new Map(links.map(link => [link.google_event_id, link]));
  const linkByApplicationId = new Map(links.map(link => [link.application_id, link]));
  const admin = createSupabaseAdminClient();
  let imported = 0;
  let cancelled = 0;

  for (const event of events) {
    const privateData = event.extendedProperties?.private;
    const applicationId = privateData?.nobel_application_id;
    if (!event.id || !applicationId || privateData?.nobel_connection_id !== connection.id) continue;
    const appointment = appointmentById.get(applicationId);
    if (!appointment) continue;
    const link = linkByEventId.get(event.id) ?? linkByApplicationId.get(applicationId);
    if (link?.google_event_etag && event.etag === link.google_event_etag) continue;

    if (event.status === "cancelled") {
      if (appointment.appointment_status !== "cancelled") {
        const { error: updateError } = await admin
          .from("applications")
          .update({ appointment_status: "cancelled" })
          .eq("id", appointment.id);
        if (updateError) throw updateError;
        const { error: eventError } = await admin.from("appointment_events").insert({
          application_id: appointment.id,
          customer_id: appointment.customer_id,
          event_type: "cancelled",
          appointment_date: appointment.appointment_date,
          location: appointment.appointment_location,
          duration_minutes: appointment.appointment_duration_minutes,
          actor_staff_id: connection.staff_id,
          note: "Google Takvim üzerinden iptal edildi.",
        });
        if (eventError) throw eventError;
        const { error: activityError } = await admin.from("activity_log").insert({
          application_id: appointment.id,
          customer_id: appointment.customer_id,
          action: "Randevu Google Takvim üzerinden iptal edildi.",
          performed_by: "Google Takvim",
          performed_by_staff_id: connection.staff_id,
          type: "appointment",
        });
        if (activityError) throw activityError;
        cancelled += 1;
      }
      await saveEventLink(connection.id, appointment.id, event, new Date().toISOString());
      continue;
    }

    const start = asRemoteDate(event.start?.dateTime);
    const end = asRemoteDate(event.end?.dateTime);
    if (!start || !end) continue;
    const duration = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (duration < 15 || duration > 480) continue;
    const location = typeof event.location === "string" ? event.location.trim().slice(0, 240) : "";
    const changed = start.toISOString() !== new Date(appointment.appointment_date).toISOString()
      || location !== (appointment.appointment_location ?? "")
      || duration !== appointment.appointment_duration_minutes
      || appointment.appointment_status === "cancelled";
    if (changed) {
      const { error: updateError } = await admin
        .from("applications")
        .update({
          appointment_date: start.toISOString(),
          appointment_location: location || null,
          appointment_duration_minutes: duration,
          appointment_status: "rescheduled",
        })
        .eq("id", appointment.id);
      if (updateError) throw updateError;
      const { error: eventError } = await admin.from("appointment_events").insert({
        application_id: appointment.id,
        customer_id: appointment.customer_id,
        event_type: "rescheduled",
        previous_date: appointment.appointment_date,
        appointment_date: start.toISOString(),
        location: location || null,
        duration_minutes: duration,
        actor_staff_id: connection.staff_id,
        note: "Google Takvim değişikliği CRM'e işlendi.",
      });
      if (eventError) throw eventError;
      const { error: activityError } = await admin.from("activity_log").insert({
        application_id: appointment.id,
        customer_id: appointment.customer_id,
        action: "Randevu Google Takvim değişikliğine göre güncellendi.",
        performed_by: "Google Takvim",
        performed_by_staff_id: connection.staff_id,
        type: "appointment",
      });
      if (activityError) throw activityError;
      imported += 1;
    }
    await saveEventLink(connection.id, appointment.id, event);
  }
  return { imported, cancelled };
}

async function findConnectionForStaff(staffId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("calendar_connections")
    .select("*")
    .eq("staff_id", staffId)
    .eq("provider", "google")
    .eq("sync_enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("google_calendar_connection_not_found"), { code: "google_calendar_connection_not_found" });
  return data;
}

async function syncConnection(connection: CalendarConnection): Promise<CalendarSyncResult> {
  const admin = createSupabaseAdminClient();
  try {
    const accessToken = await getFreshAccessToken(connection);
    const [appointments, linksResult] = await Promise.all([
      activeAppointmentsForStaff(connection.staff_id),
      admin.from("calendar_event_links").select("*").eq("connection_id", connection.id),
    ]);
    if (linksResult.error) throw linksResult.error;
    const links = linksResult.data || [];
    const exported = await exportAppointments(connection, accessToken, appointments, links);
    const changes = await readCalendarChanges(connection, accessToken);
    const incoming = await importCalendarChanges(connection, appointments, links, changes.events);
    const { error: connectionError } = await admin
      .from("calendar_connections")
      .update({
        sync_token: changes.nextSyncToken ?? connection.sync_token,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", connection.id);
    if (connectionError) throw connectionError;
    return { staffId: connection.staff_id, exported, ...incoming };
  } catch (error) {
    await admin
      .from("calendar_connections")
      .update({ last_sync_error: connectionErrorCode(error) })
      .eq("id", connection.id);
    throw error;
  }
}

export async function syncGoogleCalendarForStaff(staffId: string) {
  return syncConnection(await findConnectionForStaff(staffId));
}

export async function syncAllGoogleCalendars() {
  const { data, error } = await createSupabaseAdminClient()
    .from("calendar_connections")
    .select("id, staff_id")
    .eq("provider", "google")
    .eq("sync_enabled", true);
  if (error) throw error;
  const results: CalendarSyncResult[] = [];
  const failures: string[] = [];
  for (const connection of data || []) {
    try {
      results.push(await syncGoogleCalendarForStaff(connection.staff_id));
    } catch {
      failures.push(connection.staff_id);
    }
  }
  return { results, failures };
}
