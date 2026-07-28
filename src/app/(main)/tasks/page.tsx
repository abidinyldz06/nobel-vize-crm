import { requireStaff } from "@/lib/authz";
import TaskBoard, { type TaskItem } from "@/components/TaskBoard";

export const revalidate = 0;

const taskStatuses = new Set<TaskItem["status"]>(["pending", "in_progress", "completed", "cancelled"]);
const taskPriorities = new Set<TaskItem["priority"]>(["low", "normal", "high", "urgent"]);

export default async function TasksPage() {
  const { supabase, staff } = await requireStaff();
  const [{ data: customers }, { data: initialTasks }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, assigned_staff_id")
      .eq("is_deleted", false)
      .order("first_name"),
    supabase
      .from("tasks")
      .select(`
        id, title, description, task_type, source_type, status, priority, due_at,
        assigned_staff_id, customer_id, application_id, completed_at, created_at,
        customers(first_name, last_name),
        staff!tasks_assigned_staff_fk(full_name)
      `)
      .neq("status", "cancelled")
      .order("due_at", { ascending: true })
      .limit(250),
  ]);

  const { data: staffOptions } = staff.role === "admin"
    ? await supabase
        .from("staff")
        .select("id, full_name, role")
        .eq("is_active", true)
        .order("full_name")
    : { data: [{ id: staff.id, full_name: staff.full_name, role: staff.role }] };

  const safeInitialTasks = (initialTasks ?? []).flatMap(task => {
    if (
      !taskStatuses.has(task.status as TaskItem["status"])
      || !taskPriorities.has(task.priority as TaskItem["priority"])
    ) {
      return [];
    }
    return [{
      ...task,
      status: task.status as TaskItem["status"],
      priority: task.priority as TaskItem["priority"],
    }];
  });

  return (
    <TaskBoard
      isAdmin={staff.role === "admin"}
      currentStaffId={staff.id}
      staffOptions={staffOptions ?? []}
      customerOptions={customers ?? []}
      initialTasks={safeInitialTasks}
    />
  );
}
