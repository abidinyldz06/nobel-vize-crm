import { BarChart3, TrendingUp, ArrowUpRight, Users, FileCheck, Globe } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import ReportFilters from "@/components/ReportFilters";

export const revalidate = 0;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string, year?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const today = new Date();
  const currentMonth = params.month || String(today.getMonth() + 1).padStart(2, '0');
  const currentYear = params.year || String(today.getFullYear());

  // ISO string dates for gte / lt comparisons
  const startDate = new Date(`${currentYear}-${currentMonth}-01T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  const [
    { count: totalCustomers },
    { data: allApplications },
    { data: allDocs },
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString()),
    supabase.from('applications').select('country, status, total_fee')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString()),
    supabase.from('documents').select('status')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString()),
  ]);

  const totalApps = allApplications?.length ?? 0;
  const approved = allApplications?.filter(a => a.status === 'onaylandi').length ?? 0;
  const rejected = allApplications?.filter(a => a.status === 'reddedildi').length ?? 0;
  const approvalRate = totalApps > 0 ? ((approved / totalApps) * 100).toFixed(1) : "—";

  const pendingDocs = allDocs?.filter(d => d.status === 'bekleniyor').length ?? 0;
  const completedDocs = allDocs?.filter(d => d.status === 'tamamlandi').length ?? 0;
  const totalDocs = allDocs?.length ?? 0;
  const docCompletionRate = totalDocs > 0 ? ((completedDocs / totalDocs) * 100).toFixed(0) : "0";

  // Country distribution
  const countryMap: Record<string, number> = {};
  allApplications?.forEach(a => {
    if (a.country) countryMap[a.country] = (countryMap[a.country] || 0) + 1;
  });
  const countryStats = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCount = countryStats[0]?.[1] || 1;

  const COLORS = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-[#060d1a]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" /> Raporlar & Analizler
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Seçili ay için performans ve vize başarı oranları.</p>
        </div>
        <ReportFilters />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-blue-500">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Users className="w-3 h-3" /> Toplam Müşteri</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{totalCustomers ?? 0}</h3>
        </div>
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-purple-500">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Toplam Başvuru</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{totalApps}</h3>
        </div>
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-emerald-500">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><ArrowUpRight className="w-3 h-3 text-emerald-500" /> Onay Oranı</p>
          <h3 className={`text-3xl font-bold ${approved > 0 ? 'text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
            {approvalRate !== "—" ? `%${approvalRate}` : "—"}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{approved} onay / {rejected} red</p>
        </div>
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-amber-500">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><FileCheck className="w-3 h-3 text-amber-500" /> Evrak Tamamlama</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">%{docCompletionRate}</h3>
          <p className="text-xs text-slate-500 mt-1">{completedDocs}/{totalDocs} evrak</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Country Distribution */}
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-500" /> Ülkelere Göre Başvuru
          </h3>
          {countryStats.length > 0 ? (
            <div className="space-y-4">
              {countryStats.map(([country, count], i) => (
                <div key={country}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{country}</span>
                    <span className="text-slate-500 dark:text-slate-400">{count} başvuru ({Math.round((count / totalApps) * 100)}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${COLORS[i % COLORS.length]} transition-all duration-700 shadow-[0_0_8px_rgba(255,255,255,0.2)]`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center py-8 border border-dashed border-slate-200 dark:border-[#1f2937] rounded-xl">Henüz başvuru verisi yok.</div>
          )}
        </div>

        {/* Profile Score Analysis */}
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Profil Skoru & Onay Analizi
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] hover:border-emerald-500/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">85+</div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-200">Yüksek Profil</p>
                <p className="text-xs text-slate-500 mt-0.5">Onay Oranı: %98 (Güçlü dosya)</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] hover:border-amber-500/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-sm shrink-0">50-84</div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-200">Orta Profil</p>
                <p className="text-xs text-slate-500 mt-0.5">Onay Oranı: %76 (Ek evraklarla desteklenmeli)</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] hover:border-red-500/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 font-bold text-sm shrink-0">0-49</div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-200">Riskli Profil</p>
                <p className="text-xs text-slate-500 mt-0.5">Onay Oranı: %34 (Sponsor veya ek belge şart)</p>
              </div>
            </div>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937]">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evrak durumu: <span className="text-amber-400 font-medium">{pendingDocs} bekliyor</span>,&nbsp;
              <span className="text-emerald-400 font-medium">{completedDocs} tamamlandı</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
