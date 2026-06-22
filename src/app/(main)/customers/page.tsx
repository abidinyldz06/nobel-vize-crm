import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import CustomerTable from "@/components/CustomerTable";
import ExportButton from "@/components/ExportButton";

export const revalidate = 0;

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient();
  
  // Get current user and staff record
  const { data: { user } } = await supabase.auth.getUser();
  const { data: staffRecord } = await supabase.from('staff').select('id, role').eq('user_id', user?.id).single();
  const isAdmin = !staffRecord || staffRecord.role === 'admin';
  const staffId = staffRecord?.id;

  const query = supabase
    .from('customers')
    .select(`
      id, first_name, last_name, phone, email, created_at, profile_score,
      applications (country, status, created_at)
    `)
    .order('created_at', { ascending: false });

  if (!isAdmin && staffId) {
    query.eq('assigned_staff_id', staffId);
  }

  const { data: customers, error } = await query;

  if (error) console.error("Supabase Error:", error);

  // Flatten: add latest application's country/status to customer object
  const flat = (customers ?? []).map((c: any) => {
    const sorted = (c.applications ?? []).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    return {
      ...c,
      country: latest?.country ?? null,
      status: latest?.status ?? null,
    };
  });

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-[#060d1a]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" /> Müşteriler
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Sistemdeki tüm müşteriler ve başvuru durumları.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton data={flat} />
          <Link href="/customers/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
            <Plus className="w-4 h-4" />
            Yeni Müşteri
          </Link>
        </div>
      </div>

      <CustomerTable customers={flat} isAdmin={isAdmin} />
    </div>
  );
}
