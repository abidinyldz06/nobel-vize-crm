import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ArrowLeft, Users, FileCheck, Banknote, Calendar } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Tables } from "@/types/database";

export const revalidate = 0;

export default async function StaffPerformanceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single();

  if (!staff) return notFound();

  // Fetch all customers assigned to this staff
  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, created_at')
    .eq('is_deleted', false)
    .eq('assigned_staff_id', id)
    .order('created_at', { ascending: false });

  // Fetch apps for those customers
  let applications: Pick<Tables<'applications'>, 'id' | 'customer_id' | 'status' | 'total_fee' | 'created_at' | 'updated_at'>[] = [];
  if (customers && customers.length > 0) {
    const customerIds = customers.map(c => c.id);
    const { data: apps } = await supabase
      .from('applications')
      .select('id, customer_id, status, total_fee, created_at, updated_at')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });
    if (apps) applications = apps;
  }

  const activeApps = applications.filter(a => !['onaylandi', 'reddedildi', 'kapandi'].includes(a.status));
  const approved = applications.filter(a => a.status === 'onaylandi');
  const rejected = applications.filter(a => a.status === 'reddedildi');
  const approvalRate = (approved.length + rejected.length) > 0 ? (approved.length / (approved.length + rejected.length)) * 100 : 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <Link href="/reports" className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {staff.full_name} — Performans Detayı
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">Danışman analiz raporu ve müşteri listesi</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Users className="w-3 h-3 text-blue-500"/> Müşteriler</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{customers?.length || 0}</h3>
          </div>
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><FileCheck className="w-3 h-3 text-emerald-500"/> Onay Oranı</p>
            <h3 className="text-3xl font-bold text-emerald-500">%{approvalRate.toFixed(1)}</h3>
            <p className="text-xs text-slate-500 mt-1">{approved.length} Onay / {rejected.length} Red</p>
          </div>
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Calendar className="w-3 h-3 text-amber-500"/> Aktif Dosya</p>
            <h3 className="text-3xl font-bold text-amber-500">{activeApps.length}</h3>
          </div>
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Banknote className="w-3 h-3 text-purple-500"/> Bekleyen Tutar</p>
            <h3 className="text-3xl font-bold text-purple-500">
              ₺{activeApps.reduce((acc, a) => acc + Number(a.total_fee || 0), 0).toLocaleString('tr-TR')}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Müşteri Listesi ({customers?.length || 0})</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#1f2937]/50 max-h-[500px] overflow-y-auto">
            {customers?.map(c => {
              const custApps = applications.filter(a => a.customer_id === c.id);
              const latestApp = custApps[0];

              let statusColor = "bg-slate-100 text-slate-600";
              if (latestApp?.status === 'onaylandi') statusColor = "bg-emerald-100 text-emerald-700";
              else if (latestApp?.status === 'reddedildi') statusColor = "bg-red-100 text-red-700";
              else if (latestApp) statusColor = "bg-amber-100 text-amber-700";

              return (
                <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors">
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Kayıt: {new Date(c.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  {latestApp ? (
                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider ${statusColor}`}>
                      {latestApp.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">Başvuru Yok</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
