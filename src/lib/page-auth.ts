import "server-only";

import { redirect } from "next/navigation";
import { AuthorizationError, requireAdmin, requireStaff } from "@/lib/authz";

export async function requireStaffPage() {
  try {
    return await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/");
    throw error;
  }
}
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/dashboard");
    throw error;
  }
}
