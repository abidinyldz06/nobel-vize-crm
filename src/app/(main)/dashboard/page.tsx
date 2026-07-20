import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Users, FileText, Calendar, AlertCircle, CheckCircle2, Plus, ArrowRight, Clock, TrendingUp, DollarSign } from "lucide-react";
import Link from "next/link";
import OverdueDocuments from "@/components/OverdueDocuments";
import DashboardCharts from "@/components/DashboardCharts";

export const revalidate = 0;

export default async function Dashboard() {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Get staff record to determine role
  const { data: staffRecord } = await supabase
    .from('staff')
    .select('*')
    .eq('user_id', user?.id)
    .single();

  const isAdmin = staffRecord?.role === 'admin';
  const staffId = staffRecord?.id;

  // Build query filters based on role
  const customerQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
  const appQuery = supabase.from('applications').select('status, country, total_fee, created_at, customer_id, customers!inner(id, first_name, last_name)');
  const recentCustomerQuery = supabase.from('customers').select('id, first_name, last_name, created_at, assigned_staff_id');
  const todayAppsQuery = supabase.from('applications').select('id, country, status, customer_id, customers!inner(id)').gte('created_at', new Date().toISOString().split('T')[0]);
  const monthlyAppsQuery = supabase.from('applications').select('total_fee, customer_id, customers!inner(id)');
  const appointmentsQuery = supabase.from('applications').select('id, appointment_date, appointment_location, customer_id, customers!inner(id, first_name, last_name)').not('appointment_date', 'is', null).gte('appointment_date', new Date().toISOString()).order('appointment_date', { ascending: true }).limit(4);

  // Danışman: filter by assigned_staff_id on the customers table
  if (!isAdmin && staffId) {
    customerQuery.eq('assigned_staff_id', staffId);
    recentCustomerQuery.eq('assigned_staff_id', staffId);
    appQuery.eq('customers.assigned_staff_id', staffId);
    todayAppsQuery.eq('customers.assigned_staff_id', staffId);
    monthlyAppsQuery.eq('customers.assigned_staff_id', staffId);
    appointmentsQuery.eq('customers.assigned_staff_id', staffId);
  }

  const [
    { count: totalCustomers },
    { data: allApps },
    { data: recentCustomers },
    { data: todayApps },
  ] = await Promise.all([
    customerQuery,
    appQuery.order('created_at', { ascending: false }).limit(5),
    recentCustomerQuery.order('created_at', { ascending: false }).limit(6),
    todayAppsQuery,
  ]);

  // Yeni Sorgular (Faz 2)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  monthlyAppsQuery.gte('created_at', startOfMonth.toISOString());

  const { data: monthlyApps } = await monthlyAppsQuery;
  const expectedMonthlyRevenue = monthlyApps?.reduce((sum, app) => sum + Number(app.total_fee || 0), 0) || 0;

  const { data: upcomingAppointments } = await appointmentsQuery;

  // Documents and payments
  let allDocs: any[] | null = [];
  let allPayments: any[] | null = [];
  
  if (!isAdmin && staffId) {
    // Danışmanın müşterilerinin başvuru ID'lerini bulalım
    const { data: staffApps } = await supabase.from('applications').select('id, customers!inner(id)').eq('customers.assigned_staff_id', staffId);
    const appIds = staffApps?.map(a => a.id) || [];
    if (appIds.length > 0) {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from('documents').select('status').in('application_id', appIds),
        supabase.from('payments').select('amount, status, created_at').in('application_id', appIds)
      ]);
      allDocs = d;
      allPayments = p;
    }
  } else {
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('documents').select('status'),
      supabase.from('payments').select('amount, status, created_at')
    ]);
    allDocs = d;
    allPayments = p;
  }

  const pendingDocs = allDocs?.filter(d => d.status === 'bekleniyor').length || 0;
  const completedDocs = allDocs?.filter(d => d.status === 'tamamlandi').length || 0;
  const totalApps = allApps?.length || 0;

  // Payment metrics
  const totalCollected = allPayments?.filter(p => p.status === 'alindi').reduce((s, p) => s + Number(p.amount), 0) || 0;
  const pendingPayments = allPayments?.filter(p => p.status === 'bekliyor').reduce((s, p) => s + Number(p.amount), 0) || 0;

  // Active applications (not closed)
  const closedStatuses = ['onaylandi', 'reddedildi', 'kapandi'];
  const activeApps = allApps?.filter(a => !closedStatuses.includes(a.status || '')).length || 0;

  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    profil_analizi:     { label: "Profil Analizi",      color: "text-slate-500 dark:text-slate-400",   dot: "bg-slate-500" },
    evrak_bekleniyor:   { label: "Evrak Bekleniyor",    color: "text-amber-400",   dot: "bg-amber-500" },
    randevu_bekleniyor: { label: "Randevu Bekleniyor",  color: "text-orange-400",  dot: "bg-orange-500" },
    randevu_alindi:     { label: "Randevu Alındı",      color: "text-blue-400",    dot: "bg-blue-500" },
    evrak_hazirlaniyor: { label: "Evrak Hazırlanıyor",  color: "text-indigo-400",  dot: "bg-indigo-500" },
    basvuru_yapildi:    { label: "Başvuru Yapıldı",     color: "text-purple-400",  dot: "bg-purple-500" },
    onaylandi:          { label: "Onaylandı",           color: "text-emerald-400", dot: "bg-emerald-500" },
    reddedildi:         { label: "Reddedildi",          color: "text-red-400",     dot: "bg-red-500" },
    kapandi:            { label: "Kapandı",             color: "text-slate-400",   dot: "bg-slate-500" },
  };

  // --- CHART DATA PROCESSING ---
  const sixMonthsAgoDate = new Date();
  sixMonthsAgoDate.setMonth(sixMonthsAgoDate.getMonth() - 5);
  sixMonthsAgoDate.setDate(1);
  sixMonthsAgoDate.setHours(0, 0, 0, 0);

  const chartsAppsQuery = supabase
    .from('applications')
    .select('country, status, created_at, customers!inner(assigned_staff_id)')
    .gte('created_at', sixMonthsAgoDate.toISOString());

  if (!isAdmin && staffId) {
    chartsAppsQuery.eq('customers.assigned_staff_id', staffId);
  }

  const { data: chartsApps } = await chartsAppsQuery;

  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { 
      key: `${d.getFullYear()}-${d.getMonth()}`, 
      label: `${months[d.getMonth()]} '${d.getFullYear().toString().substring(2)}` 
    };
  });

  const monthlyData = last6Months.map(m => ({ month: m.label, count: 0, _key: m.key }));
  const revenueData = last6Months.map(m => ({ month: m.label, amount: 0, _key: m.key }));
  const countryMap: Record<string, number> = {};
  const statusMap: Record<string, number> = {};

  (chartsApps || []).forEach((app: any) => {
    const d = new Date(app.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const mItem = monthlyData.find(m => m._key === key);
    if (mItem) mItem.count++;

    if (app.country) countryMap[app.country] = (countryMap[app.country] || 0) + 1;
    const statusLabel = STATUS_CONFIG[app.status]?.label || app.status;
    statusMap[statusLabel] = (statusMap[statusLabel] || 0) + 1;
  });

  (allPayments || []).forEach((p: any) => {
    if (p.status === 'alindi') {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const rItem = revenueData.find(r => r._key === key);
      if (rItem) rItem.amount += Number(p.amount || 0);
    }
  });

  const countryData = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-7">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            {/* Role badge */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'}`}>
              {isAdmin ? '🛡 Yönetici' : '👤 Danışman'}
            </span>
          </div>
          <p className="text-slate-500 text-xs">{today}</p>
          {!isAdmin && staffRecord && (
            <p className="text-slate-600 text-xs mt-0.5">Sadece size atanmış müşteriler gösteriliyor</p>
          )}
        </div>
        <Link href="/customers/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
          <Plus className="w-4 h-4" /> Yeni Müşteri
        </Link>
      </header>

      {/* Stat Cards — 6 metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[
          { label: "Toplam Müşteri",  value: totalCustomers ?? 0, icon: Users,         accent: "border-t-blue-500",    iconBg: "bg-blue-500/10",    iconColor: "text-blue-400",    href: "/customers" },
          { label: "Aktif Başvuru",   value: activeApps,          icon: FileText,       accent: "border-t-purple-500",  iconBg: "bg-purple-500/10",  iconColor: "text-purple-400",  href: "/customers" },
          { label: "Evrak Bekliyor",  value: pendingDocs,         icon: AlertCircle,    accent: "border-t-amber-500",   iconBg: "bg-amber-500/10",   iconColor: "text-amber-400",   href: "/customers" },
          { label: "Evrak Tamam",     value: completedDocs,       icon: CheckCircle2,   accent: "border-t-emerald-500", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400", href: "/customers" },
          { label: "Aylık Beklenen",  value: `₺${(expectedMonthlyRevenue/1000).toFixed(0)}K`, icon: DollarSign, accent: "border-t-indigo-500", iconBg: "bg-indigo-500/10", iconColor: "text-indigo-400", href: "/reports" },
          { label: "Bugünkü Başvuru", value: todayApps?.length ?? 0, icon: Calendar,   accent: "border-t-sky-500",     iconBg: "bg-sky-500/10",     iconColor: "text-sky-400",     href: "/appointments" },
        ].map((s, i) => (
          <Link key={i} href={s.href} className={`bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] border-t-2 ${s.accent} p-4 rounded-2xl shadow-lg hover:bg-slate-100 dark:bg-[#1a2232] transition-colors group`}>
            <div className={`w-8 h-8 ${s.iconBg} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <s.icon className={`w-4 h-4 ${s.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Admin only: pending fee warning */}
      {isAdmin && pendingPayments > 0 && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Tahsil Edilmemiş Ödeme</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">₺{pendingPayments.toLocaleString('tr-TR')} tutarında bekleyen ödeme var.</p>
          </div>
          <Link href="/reports" className="ml-auto text-xs text-amber-400 hover:text-amber-300 underline whitespace-nowrap">Raporlar →</Link>
        </div>
      )}

      {/* Recharts Component */}
      <DashboardCharts 
        monthlyData={monthlyData} 
        countryData={countryData} 
        statusData={statusData} 
        revenueData={revenueData} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Applications */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isAdmin ? "Son Başvurular" : "Başvurularınız"}
            </h2>
            <Link href="/customers" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Tümü <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
            {allApps && allApps.length > 0 ? allApps.map((app: any) => {
              const cfg = STATUS_CONFIG[app.status] || { label: app.status, color: "text-slate-500 dark:text-slate-400", dot: "bg-slate-500" };
              return (
                <Link
                  key={app.id || Math.random()}
                  href={`/customers/${(app.customers as any)?.id || ''}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-300 font-bold text-xs uppercase shrink-0">
                    {(app.customers as any)?.first_name?.[0]}{(app.customers as any)?.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-200 text-sm truncate">
                      {(app.customers as any)?.first_name} {(app.customers as any)?.last_name}
                    </p>
                    <p className="text-xs text-slate-500">{app.country} Vizesi</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(app.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </Link>
              );
            }) : (
              <div className="px-6 py-10 text-center text-slate-600 text-sm">
                {isAdmin ? "Henüz başvuru yok." : "Size atanmış başvuru yok."}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-5 space-y-5">
          {/* Geciken Evraklar */}
          <OverdueDocuments isAdmin={isAdmin} staffId={staffId} />

          {/* Yaklaşan Randevular (Faz 2) */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" /> Yaklaşan Randevular
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {upcomingAppointments && upcomingAppointments.length > 0 ? upcomingAppointments.map((app: any) => (
                <Link key={app.id} href={`/customers/${(app.customers as any)?.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex flex-col items-center justify-center shrink-0 border border-blue-500/20">
                    <span className="text-[10px] font-semibold text-blue-400 leading-none">{new Date(app.appointment_date).getDate()}</span>
                    <span className="text-[9px] text-blue-300 uppercase mt-0.5">{new Date(app.appointment_date).toLocaleString('tr-TR', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{(app.customers as any)?.first_name} {(app.customers as any)?.last_name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{app.appointment_location}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                    {new Date(app.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              )) : (
                <div className="px-5 py-6 text-center text-slate-600 text-sm">Yaklaşan randevu yok.</div>
              )}
            </div>
          </div>

          {/* Recent Customers */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Son Müşteriler</h2>
              <Link href="/customers/new" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ekle
              </Link>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {recentCustomers && recentCustomers.length > 0 ? recentCustomers.map((c: any) => (
                <Link key={c.id} href={`/customers/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-800 to-purple-900 flex items-center justify-center text-[10px] font-bold text-blue-300 uppercase shrink-0">
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{c.first_name} {c.last_name}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">
                    {new Date(c.created_at).toLocaleDateString('tr-TR')}
                  </span>
                </Link>
              )) : (
                <div className="px-5 py-8 text-center text-slate-600 text-sm">Müşteri yok.</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Hızlı İşlemler</h2>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { href: "/customers/new",  label: "Yeni Müşteri",    icon: Users,    color: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400" },
                { href: "/appointments",   label: "Randevular",      icon: Calendar, color: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 text-purple-400" },
                { href: "/reports",        label: "Raporlar",         icon: TrendingUp, color: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400" },
                ...(isAdmin ? [{ href: "/staff", label: "Personel", icon: Users, color: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-400" }] : [
                  { href: "/countries", label: "Ülkeler", icon: AlertCircle, color: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-400" }
                ]),
              ].map((a, i) => (
                <Link key={i} href={a.href}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border ${a.color} transition-colors`}
                >
                  <a.icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
