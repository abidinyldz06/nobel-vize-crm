import { createSupabaseServerClient } from "@/lib/supabase-server";
import CalendarView from "@/components/Calendar/CalendarView";

export const revalidate = 0;

export default async function AppointmentsPage() {
  const supabase = await createSupabaseServerClient();
  
  const { data: appointments } = await supabase
    .from('applications')
    .select(`
      id, 
      country, 
      status,
      appointment_date, 
      appointment_location,
      customers (id, first_name, last_name, phone)
    `)
    .not('appointment_date', 'is', null)
    .order('appointment_date', { ascending: true });

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-7xl mx-auto h-full">
        <CalendarView appointments={appointments || []} />
      </div>
    </div>
  );
}
