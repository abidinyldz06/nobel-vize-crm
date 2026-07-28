import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import { observedRoute } from "@/lib/observability";

function icsEscape(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function icsTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function exportAppointment(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let supabase;
  try {
    ({ supabase } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { id } = await context.params;
  const { data: appointment, error } = await supabase
    .from("applications")
    .select("id, country, visa_type, appointment_date, appointment_location, appointment_duration_minutes, appointment_status, customers!inner(first_name, last_name)")
    .eq("id", id)
    .eq("customers.is_deleted", false)
    .single();
  if (error || !appointment?.appointment_date) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }

  const start = new Date(appointment.appointment_date);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Randevu tarihi geçersiz." }, { status: 400 });
  }
  const end = new Date(start.getTime() + appointment.appointment_duration_minutes * 60_000);
  const customer = appointment.customers;
  const summary = `${customer.first_name} ${customer.last_name} - ${appointment.country} vize randevusu`;
  const description = `${appointment.visa_type ?? "Vize"} başvurusu. Durum: ${appointment.appointment_status ?? "scheduled"}.`;
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nobel Vize CRM//Randevu//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@nobelvize.com`,
    `DTSTAMP:${icsTimestamp(new Date())}`,
    `DTSTART:${icsTimestamp(start)}`,
    `DTEND:${icsTimestamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(appointment.appointment_location ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="randevu-${appointment.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const GET = observedRoute("appointments.export_ics", exportAppointment);
