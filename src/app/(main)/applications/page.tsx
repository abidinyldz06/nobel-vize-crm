import { requireStaffPage } from "@/lib/page-auth";
import ApplicationBoard from "@/components/ApplicationBoard";

export const revalidate = 0;

export default async function ApplicationsPage() {
  const { supabase } = await requireStaffPage();
  const { data, error } = await supabase
    .from("applications")
    .select(`
      id, customer_id, country, visa_type, status, created_at, updated_at,
      appointment_date, assigned_staff_id,
      customers!inner(id, first_name, last_name, is_deleted),
      assigned_staff:staff!applications_assigned_staff_fk(id, full_name)
    `)
    .eq("customers.is_deleted", false)
    .order("updated_at", { ascending: false });

  return (
    <ApplicationBoard
      initialApplications={error ? [] : (data ?? [])}
      loadError={error?.message ?? null}
    />
  );
}
