import Link from "next/link";
import { Archive, ArrowLeft } from "lucide-react";
import CustomerArchiveTable, { type ArchivedCustomer } from "@/components/CustomerArchiveTable";
import { reviewArchivedOpenApplications, type ArchivedApplicationRow } from "@/lib/archived-application-review";
import { requireAdminPage } from "@/lib/page-auth";
import { readAllPages } from "@/lib/read-all-pages";

export const revalidate = 0;

async function readArchivedApplicationReview(supabase: Awaited<ReturnType<typeof requireAdminPage>>["supabase"], customers: ArchivedCustomer[]) {
  if (customers.length === 0) return [];
  const applications: ArchivedApplicationRow[] = [];
  for (let index = 0; index < customers.length; index += 80) {
    const ids = customers.slice(index, index + 80).map(customer => customer.id);
    applications.push(...await readAllPages((from, to) => supabase.from("applications")
      .select("id,customer_id,status,updated_at,assigned_staff_id", { count: "exact" })
      .in("customer_id", ids)
      .order("id")
      .range(from, to)));
  }
  const staff = await readAllPages((from, to) => supabase.from("staff")
    .select("id,is_active", { count: "exact" })
    .order("id")
    .range(from, to));
  return reviewArchivedOpenApplications({
    applications,
    customers: customers.map(customer => ({ id: customer.id, assignedStaffId: customer.assigned_staff_id })),
    staff,
  });
}

export default async function CustomerArchivePage() {
  const { supabase } = await requireAdminPage();
  const [{ data, error }, { data: privacyCandidates, error: privacyError }] = await Promise.all([
    supabase.rpc("list_archived_customers_v1"),
    supabase.rpc("list_archived_customer_privacy_v1"),
  ]);
  const customers = (data ?? []) as ArchivedCustomer[];
  let openApplications: ReturnType<typeof reviewArchivedOpenApplications> = [];
  let reviewUnavailable = false;
  if (!error && !privacyError) {
    try {
      openApplications = await readArchivedApplicationReview(supabase, customers);
    } catch {
      reviewUnavailable = true;
    }
  }

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-[#060d1a]">
      <div className="mb-7 flex items-center gap-4">
        <Link href="/customers" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-[#1f2937] dark:bg-[#0d1420] dark:hover:bg-[#1a2232]">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <Archive className="h-5 w-5 text-amber-500" /> Müşteri Arşivi
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">Arşiv kayıtlarını geri yükleyin veya onaylı talep, bekleme süresi ve anonimleştirme sonrasında kalıcı silin.</p>
        </div>
      </div>

      {error || privacyError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-500">
          Arşiv yüklenemedi: {error?.message || privacyError?.message}
        </div>
      ) : (
        <CustomerArchiveTable customers={customers} privacyCandidates={privacyCandidates ?? []} openApplications={openApplications} reviewUnavailable={reviewUnavailable} />
      )}
    </div>
  );
}
