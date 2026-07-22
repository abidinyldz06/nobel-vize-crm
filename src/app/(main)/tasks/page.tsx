import { requireStaff } from "@/lib/authz";
import TaskBoard from "@/components/TaskBoard";

export const revalidate = 0;

export default async function TasksPage() {
  const { supabase, staff } = await requireStaff();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, assigned_staff_id")
    .eq("is_deleted", false)
    .order("first_name");

  const { data: staffOptions } = staff.role === "admin"
    ? await supabase
        .from("staff")
        .select("id, full_name, role")
        .eq("is_active", true)
        .order("full_name")
    : { data: [{ id: staff.id, full_name: staff.full_name, role: staff.role }] };

  return (
    <TaskBoard
      isAdmin={staff.role === "admin"}
      currentStaffId={staff.id}
      staffOptions={staffOptions ?? []}
      customerOptions={customers ?? []}
    />
  );
}
