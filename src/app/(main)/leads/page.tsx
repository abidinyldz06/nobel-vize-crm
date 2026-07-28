import LeadManagementClient from "@/components/LeadManagementClient";
import { requireStaffPage } from "@/lib/page-auth";

export const revalidate = 0;

export default async function LeadsPage() {
  const { supabase, staff } = await requireStaffPage();
  const [{ data: leads }, { data: staffList }, { data: countries }] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("staff").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("countries").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <LeadManagementClient
      initialLeads={leads ?? []}
      staffList={staffList ?? []}
      countries={countries ?? []}
      isAdmin={staff.role === "admin"}
      currentStaffId={staff.id}
    />
  );
}
