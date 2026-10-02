import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readAllPages } from "@/lib/read-all-pages";
import { summarizeDataQuality } from "@/lib/data-quality-summary";

export async function readDataQualitySummary(supabase: SupabaseClient<Database>) {
  const [customers, applications, tasks, staff, archivedCustomers] = await Promise.all([
    readAllPages((from, to) => supabase.from("customers")
      .select("id,is_deleted,phone,email,passport_no,passport_expiry,assigned_staff_id", { count: "exact" })
      .order("id").range(from, to)),
    readAllPages((from, to) => supabase.from("applications")
      .select("id,customer_id,status,country_id,country,visa_type,assigned_staff_id,travel_method,accommodation,occupation,with_children,nationality", { count: "exact" })
      .not("status", "in", "(onaylandi,reddedildi,kapandi)").order("id").range(from, to)),
    readAllPages((from, to) => supabase.from("tasks")
      .select("idempotency_key,status,due_at,assigned_staff_id,completed_at", { count: "exact" })
      .eq("source_type", "data_quality").order("id").range(from, to)),
    readAllPages((from, to) => supabase.from("staff")
      .select("id,is_active", { count: "exact" }).order("id").range(from, to)),
    // Customer RLS deliberately hides archived rows, including from admins.
    // Reuse the archive page's STABLE, admin-checked read function; select IDs only.
    readAllPages((from, to) => supabase.rpc("list_archived_customers_v1", undefined, { count: "exact" })
      .select("id").order("id").range(from, to)),
  ]);
  return summarizeDataQuality({ customers, applications, tasks, staff, archivedCustomerIds: archivedCustomers.map(customer => customer.id) });
}
