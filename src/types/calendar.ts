export type CalendarAppointment = {
  id: string;
  country: string;
  status: string;
  appointment_date: string;
  appointment_location: string | null;
  appointment_status: string | null;
  appointment_duration_minutes: number;
  appointment_timezone: string;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
};
