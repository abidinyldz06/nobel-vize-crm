import { createSupabaseServerClient } from "@/lib/supabase-server";
import CalendarView from "@/components/Calendar/CalendarView";

export const revalidate = 0;

export default async function AppointmentsPage() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  const { data: staffRecord } = await supabase.from('staff').select('id, role').eq('user_id', user?.id).single();
  const isAdmin = staffRecord?.role === 'admin';
  const staffId = staffRecord?.id;

  const query = supabase
    .from('applications')
    .select(`
      id, 
      country, 
      status,
      appointment_date, 
      appointment_location,
      customers!inner (id, first_name, last_name, phone)
    `)
    .not('appointment_date', 'is', null)
    .order('appointment_date', { ascending: true });

  if (!isAdmin && staffId) {
    query.eq('customers.assigned_staff_id', staffId);
  }

  const { data: appointments } = await query;

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-7xl mx-auto h-full">
        <CalendarView appointments={appointments || []} />
      </div>
    </div>
  );
}
