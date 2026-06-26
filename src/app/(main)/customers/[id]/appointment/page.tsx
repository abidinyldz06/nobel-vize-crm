import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ArrowLeft, AlertCircle, Calendar } from "lucide-react";
import Link from "next/link";
import AppointmentFormClient from "@/components/AppointmentFormClient";

export const revalidate = 0;

export default async function AddAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();
  const { data: applications } = await supabase
    .from('applications')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  const activeApp = applications?.[0];

  if (!customer) return <div className="p-6 text-slate-500 dark:text-slate-400">Müşteri bulunamadı.</div>;
  if (!activeApp) return (
    <div className="p-6 flex items-center gap-2 text-slate-500 dark:text-slate-400">
      <AlertCircle className="w-5 h-5" /> Aktif başvuru bulunamadı. Önce müşteri oluşturun.
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <Link href={`/customers/${id}`} className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" /> Randevu Ekle
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {customer.first_name} {customer.last_name} — {activeApp.country} Vizesi
            </p>
          </div>
        </div>

        <AppointmentFormClient customerId={customer.id} applicationId={activeApp.id} />
      </div>
    </div>
  );
}
