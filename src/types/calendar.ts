export type CalendarAppointment = {
  id: string;
  country: string;
  status: string;
  appointment_date: string;
  appointment_location: string | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
};
