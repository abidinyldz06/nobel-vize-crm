import { isOpenApplicationStatus } from "./application-status";

export type AssigneePresence = "active" | "inactive" | "none";

export type ArchivedApplicationRow = {
  id: string;
  customer_id: string;
  status: string;
  updated_at: string;
  assigned_staff_id: string | null;
};

export type ArchivedCustomerAssignee = {
  id: string;
  assignedStaffId: string | null;
};

export type ArchivedOpenApplicationReview = {
  id: string;
  customerId: string;
  status: string;
  updatedAt: string;
  assignee: AssigneePresence;
};

function presentId(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assigneePresence(applicationStaffId: string | null, customerStaffId: string | null, activeStaff: Set<string>): AssigneePresence {
  const ids = [presentId(applicationStaffId), presentId(customerStaffId)].filter((id): id is string => id !== null);
  if (ids.length === 0) return "none";
  return ids.some(id => activeStaff.has(id)) ? "active" : "inactive";
}

// Same open set as the data-quality summary: onaylandi, reddedildi and kapandi are closed.
// itiraz stays open. No records are changed.
export function reviewArchivedOpenApplications(input: {
  applications: ArchivedApplicationRow[];
  customers: ArchivedCustomerAssignee[];
  staff: Array<{ id: string; is_active: boolean }>;
}): ArchivedOpenApplicationReview[] {
  const customers = new Map(input.customers.map(customer => [customer.id, customer]));
  const activeStaff = new Set(input.staff.filter(member => member.is_active).map(member => member.id));
  return input.applications
    .filter(application => customers.has(application.customer_id) && isOpenApplicationStatus(application.status))
    .map(application => ({
      id: application.id,
      customerId: application.customer_id,
      status: application.status,
      updatedAt: application.updated_at,
      assignee: assigneePresence(
        application.assigned_staff_id,
        customers.get(application.customer_id)?.assignedStaffId ?? null,
        activeStaff,
      ),
    }))
    .sort((left, right) => {
      const byTime = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      return byTime || left.id.localeCompare(right.id);
    });
}
