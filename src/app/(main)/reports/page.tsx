import { BarChart3, TrendingUp, ArrowUpRight, Users, FileCheck, Globe, Banknote, Wallet, CreditCard, Percent, UserCog, Calendar } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import ReportFilters from "@/components/ReportFilters";
import StaffPerformance from "@/components/StaffPerformance";
import RejectionAnalysis from "@/components/RejectionAnalysis";
import VisaSuccessMatrix from "@/components/VisaSuccessMatrix";
import RevenueProjection from "@/components/RevenueProjection";
import {
  averageProcessDays,
  countActiveApplications,
  filterByRange,
  monthRangeUtc,
  normalizeReportPeriod,
  shiftMonthRange,
  sumExpectedRevenue,
  sumPayments,
  summarizeApplications,
  summarizeDocuments,
} from "@/lib/report-metrics";
import type { Tables } from "@/types/database";

export const revalidate = 0;

type StaffPerformanceMetric = {
  id: string;
  name: string;
  totalCustomers: number;
  activeApps: number;
  approved: number;
  rejected: number;
  revenue: number;
  totalProcessTimeMs: number;
  completedCount: number;
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string, year?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const today = new Date();
  const period = normalizeReportPeriod(params.month, params.year, today);
  const selectedMonthRange = monthRangeUtc(period.year, period.month);
  const { start: startDate, end: endDate } = selectedMonthRange;

  // Get current user and staff record
  const { data: { user } } = await supabase.auth.getUser();
  const { data: staffRecord } = await supabase.from('staff').select('id, role').eq('user_id', user?.id ?? '').single();
  const isAdmin = staffRecord?.role === 'admin';
  const staffId = staffRecord?.id;

  const totalCustomersQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
  const monthlyCustomersQuery = supabase.from('customers').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()).lt('created_at', endDate.toISOString());
  // These records feed all-time, active, yearly and selected-period metrics.
  // Keeping the complete authorized set prevents the old six-month truncation bug.
  const allAppsQuery = supabase.from('applications').select('id, customer_id, country, visa_type, status, total_fee, created_at, updated_at, customers!inner(id, assigned_staff_id)');
  const allCustomersQuery = supabase.from('customers').select('id, assigned_staff_id, created_at');

  if (!isAdmin && staffId) {
    totalCustomersQuery.eq('assigned_staff_id', staffId);
    monthlyCustomersQuery.eq('assigned_staff_id', staffId);
    allAppsQuery.eq('customers.assigned_staff_id', staffId);
    allCustomersQuery.eq('assigned_staff_id', staffId);
  }

  const [
    { count: totalCustomers },
    { count: monthlyCustomers },
    { data: allApplications },
    { data: allStaff },
    { data: allCustomers },
  ] = await Promise.all([
    totalCustomersQuery,
    monthlyCustomersQuery,
    allAppsQuery,
    supabase.from('staff').select('id, full_name'),
    allCustomersQuery,
  ]);

  let allDocs: Pick<Tables<'documents'>, 'status'>[] = [];
  let allPayments: Pick<Tables<'payments'>, 'application_id' | 'amount' | 'status' | 'created_at'>[] = [];

  if (!isAdmin && staffId) {
    const appIds = allApplications?.map((application) => application.id) || [];
    if (appIds.length > 0) {
      const [{ data: docs }, { data: payments }] = await Promise.all([
        supabase.from('documents').select('status').gte('created_at', startDate.toISOString()).lt('created_at', endDate.toISOString()).in('application_id', appIds),
        supabase.from('payments').select('application_id, amount, status, created_at').in('application_id', appIds)
      ]);
      allDocs = docs ?? [];
      allPayments = payments ?? [];
    }
  } else {
    const [{ data: docs }, { data: payments }] = await Promise.all([
      supabase.from('documents').select('status').gte('created_at', startDate.toISOString()).lt('created_at', endDate.toISOString()),
      supabase.from('payments').select('application_id, amount, status, created_at')
    ]);
    allDocs = docs ?? [];
    allPayments = payments ?? [];
  }

  const applications = allApplications ?? [];
  const customers = allCustomers ?? [];
  const staff = allStaff ?? [];
  const monthlyApps = filterByRange(applications, selectedMonthRange);

  const monthlyApplicationSummary = summarizeApplications(monthlyApps);
  const { total: totalApps, approved, rejected } = monthlyApplicationSummary;
  const approvalRate = monthlyApplicationSummary.approvalRate?.toFixed(1) ?? "—";

  const documentSummary = summarizeDocuments(allDocs);
  const { pending: pendingDocs, completed: completedDocs, total: totalDocs } = documentSummary;
  const docCompletionRate = documentSummary.completionRate.toFixed(0);

  // Country distribution
  const countryMap: Record<string, number> = {};
  monthlyApps.forEach(a => {
    if (a.country) countryMap[a.country] = (countryMap[a.country] || 0) + 1;
  });
  const countryStats = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCount = countryStats[0]?.[1] || 1;

  // A. AYLIK GELİR KARTLARI
  const monthlyPayments = filterByRange(allPayments, selectedMonthRange);
  const tahsilEdilen = sumPayments(monthlyPayments, 'alindi');
  const bekleyen = sumPayments(monthlyPayments, 'bekliyor');
  const toplamBeklenen = sumExpectedRevenue(monthlyApps);
  const tahsilatOrani = toplamBeklenen > 0 ? ((tahsilEdilen / toplamBeklenen) * 100).toFixed(1) : "0";

  // B. DANIŞMAN BAZINDA GELİR
  const staffIncomeMap: Record<string, { name: string, customerCount: Set<string>, collected: number, pending: number }> = {};
  staff.forEach(s => {
    staffIncomeMap[s.id] = { name: s.full_name, customerCount: new Set(), collected: 0, pending: 0 };
  });

  const customerStaffMap: Record<string, string> = {};
  customers.forEach(c => {
    if (c.assigned_staff_id) customerStaffMap[c.id] = c.assigned_staff_id;
  });

  const appCustomerMap: Record<string, string> = {};
  applications.forEach(a => {
    if (a.customer_id) appCustomerMap[a.id] = a.customer_id;
  });

  allPayments.forEach(p => {
    const custId = appCustomerMap[p.application_id];
    if (!custId) return;
    const staffId = customerStaffMap[custId];
    if (!staffId || !staffIncomeMap[staffId]) return;

    staffIncomeMap[staffId].customerCount.add(custId);
    if (p.status === 'alindi') staffIncomeMap[staffId].collected += Number(p.amount);
    if (p.status === 'bekliyor') staffIncomeMap[staffId].pending += Number(p.amount);
  });

  const staffStats = Object.values(staffIncomeMap)
    .filter(s => s.collected > 0 || s.pending > 0 || s.customerCount.size > 0)
    .sort((a, b) => b.collected - a.collected);

  // C. ÜLKE BAZINDA GELİR
  const countryIncomeMap: Record<string, { apps: number, expected: number, collected: number }> = {};
  applications.forEach(a => {
    if (!a.country) return;
    if (!countryIncomeMap[a.country]) {
      countryIncomeMap[a.country] = { apps: 0, expected: 0, collected: 0 };
    }
    countryIncomeMap[a.country].apps += 1;
    countryIncomeMap[a.country].expected += Number(a.total_fee || 0);
  });
  allPayments.forEach(p => {
    const app = applications.find(a => a.id === p.application_id);
    if (app?.country && p.status === 'alindi') {
      if (!countryIncomeMap[app.country]) countryIncomeMap[app.country] = { apps: 0, expected: 0, collected: 0 };
      countryIncomeMap[app.country].collected += Number(p.amount);
    }
  });

  const countryIncomeStats = Object.entries(countryIncomeMap)
    .map(([country, stats]) => ({ country, ...stats }))
    .sort((a, b) => b.collected - a.collected);

  // D. SON 6 AY TREND
  const monthsData: Record<string, { label: string, collected: number, pending: number }> = {};
  const formatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    monthsData[key] = { label: formatter.format(d), collected: 0, pending: 0 };
  }

  allPayments.forEach(p => {
    const d = new Date(p.created_at);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (monthsData[key]) {
      if (p.status === 'alindi') monthsData[key].collected += Number(p.amount);
      if (p.status === 'bekliyor') monthsData[key].pending += Number(p.amount);
    }
  });

  const trendStats = Object.values(monthsData);

  // --- REVENUE PROJECTION & GOALS ---
  const lastMonthRange = shiftMonthRange(selectedMonthRange, -1);
  const yearRange = {
    start: new Date(Date.UTC(period.year, 0, 1)),
    end: new Date(Date.UTC(period.year + 1, 0, 1)),
  };

  const activeApps = applications.filter((application) => !['onaylandi', 'reddedildi', 'kapandi'].includes(application.status));
  const activeAppsCount = countActiveApplications(applications);
  const expectedRevenue = sumExpectedRevenue(activeApps);

  // This month
  const thisMonthApps = monthlyApps;
  const thisMonthPayments = monthlyPayments;
  const thisMonthCustomers = filterByRange(customers, selectedMonthRange);

  const thisMonth = {
    customers: thisMonthCustomers.length,
    apps: thisMonthApps.length,
    revenue: sumPayments(thisMonthPayments, 'alindi'),
    approved: thisMonthApps.filter((application) => application.status === 'onaylandi').length
  };

  // Last month
  const lastMonthApps = filterByRange(applications, lastMonthRange);
  const lastMonthPayments = filterByRange(allPayments, lastMonthRange);
  const lastMonthCustomers = filterByRange(customers, lastMonthRange);

  const lastMonth = {
    customers: lastMonthCustomers.length,
    apps: lastMonthApps.length,
    revenue: sumPayments(lastMonthPayments, 'alindi'),
    approved: lastMonthApps.filter((application) => application.status === 'onaylandi').length
  };

  // Yearly
  const yearlyApps = filterByRange(applications, yearRange);
  const yearlyPayments = filterByRange(allPayments, yearRange);
  const yearlyCustomers = filterByRange(customers, yearRange);

  const currentUtcYear = today.getUTCFullYear();
  const monthsCount = period.year < currentUtcYear
    ? 12
    : period.year === currentUtcYear
      ? today.getUTCMonth() + 1
      : 0;

  const yearly = {
    customers: yearlyCustomers.length,
    apps: yearlyApps.length,
    revenue: sumPayments(yearlyPayments, 'alindi'),
    monthsCount
  };

  // Avg Process Days
  const avgProcessDays = averageProcessDays(applications);

  // E. STAFF PERFORMANCE FULL DATA (All time)
  let staffPerfData: Array<Omit<StaffPerformanceMetric, 'totalProcessTimeMs' | 'completedCount'> & {
    approvalRate: number;
    avgProcessTimeDays: number | null;
  }> = [];
  let rejectedAppsData: Array<{ rejection_reason: string; country: string; visa_type: string }> = [];
  if (isAdmin) {
    const { data: perfApps } = await supabase.from('applications').select('id, customer_id, status, created_at, updated_at, customers!inner(assigned_staff_id)');
    const { data: perfPayments } = await supabase.from('payments').select('amount, status, application_id');
    const { data: rejectedApps } = await supabase
      .from('applications')
      .select('rejection_reason, country, visa_type')
      .eq('status', 'reddedildi')
      .not('rejection_reason', 'is', null);
    
    if (rejectedApps) {
      rejectedAppsData = rejectedApps.flatMap((application) =>
        application.rejection_reason
          ? [{
              rejection_reason: application.rejection_reason,
              country: application.country,
              visa_type: application.visa_type,
            }]
          : [],
      );
    }

    const perfStaffMap: Record<string, StaffPerformanceMetric> = {};
    staff.forEach((s) => {
      perfStaffMap[s.id] = { id: s.id, name: s.full_name, totalCustomers: 0, activeApps: 0, approved: 0, rejected: 0, revenue: 0, totalProcessTimeMs: 0, completedCount: 0 };
    });

    customers.forEach((c) => {
      if (c.assigned_staff_id && perfStaffMap[c.assigned_staff_id]) {
        perfStaffMap[c.assigned_staff_id].totalCustomers++;
      }
    });

    perfApps?.forEach((application) => {
      const assignedStaffId = application.customers?.assigned_staff_id;
      if (!assignedStaffId || !perfStaffMap[assignedStaffId]) return;
      
      const s = perfStaffMap[assignedStaffId];
      if (['onaylandi', 'reddedildi', 'kapandi'].includes(application.status)) {
        if (application.status === 'onaylandi') s.approved++;
        if (application.status === 'reddedildi') s.rejected++;
        
        // processing time
        if (application.created_at && application.updated_at) {
           const timeDiff = new Date(application.updated_at).getTime() - new Date(application.created_at).getTime();
           if (timeDiff > 0) {
             s.totalProcessTimeMs += timeDiff;
             s.completedCount++;
           }
        }
      } else {
        s.activeApps++;
      }
    });

    perfPayments?.forEach((p) => {
      if (p.status === 'alindi') {
        const app = perfApps?.find((application) => application.id === p.application_id);
        if (app) {
          const assignedStaffId = app.customers?.assigned_staff_id;
          if (assignedStaffId && perfStaffMap[assignedStaffId]) {
            perfStaffMap[assignedStaffId].revenue += Number(p.amount);
          }
        }
      }
    });

    staffPerfData = Object.values(perfStaffMap).map((s) => {
      const totalDecided = s.approved + s.rejected;
      const approvalRate = totalDecided > 0 ? (s.approved / totalDecided) * 100 : 0;
      const avgProcessTimeDays = s.completedCount > 0 ? (s.totalProcessTimeMs / s.completedCount) / (1000 * 60 * 60 * 24) : null;
      return {
        id: s.id,
        name: s.name,
        totalCustomers: s.totalCustomers,
        activeApps: s.activeApps,
        approved: s.approved,
        rejected: s.rejected,
        approvalRate,
        revenue: s.revenue,
        avgProcessTimeDays
      };
    });
  }

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
          <p className="text-xs text-blue-500 mt-1 font-medium">+{monthlyCustomers ?? 0} bu ay eklendi</p>
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

      {/* MATRIX */}
      <VisaSuccessMatrix data={applications} staffList={staff} />

      {/* REVENUE PROJECTION */}
      <RevenueProjection 
        activeAppsCount={activeAppsCount}
        expectedRevenue={expectedRevenue}
        avgProcessDays={avgProcessDays}
        thisMonth={thisMonth}
        lastMonth={lastMonth}
        yearly={yearly}
      />

      {/* GELİR ÖZETİ SECTION */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
          <Wallet className="w-5 h-5 text-emerald-500" /> Gelir Detayları
        </h2>

        {/* 4 Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-emerald-500 hover:-translate-y-1 transition-transform">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Banknote className="w-3 h-3 text-emerald-500" /> Tahsil Edilen</p>
            <h3 className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">₺{tahsilEdilen.toLocaleString('tr-TR')}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Bu ay</p>
          </div>
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-amber-500 hover:-translate-y-1 transition-transform">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1"><CreditCard className="w-3 h-3 text-amber-500"/> Bekleyen</p>
            <h3 className="text-3xl font-bold text-amber-500 dark:text-amber-400">₺{bekleyen.toLocaleString('tr-TR')}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Bu ay</p>
          </div>
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-blue-500 hover:-translate-y-1 transition-transform">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Wallet className="w-3 h-3 text-blue-500" /> Toplam Beklenen</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">₺{toplamBeklenen.toLocaleString('tr-TR')}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Yeni başvurular</p>
          </div>
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg border-t-2 border-t-purple-500 hover:-translate-y-1 transition-transform">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Percent className="w-3 h-3 text-purple-500" /> Tahsilat Oranı</p>
            <h3 className="text-3xl font-bold text-purple-500 dark:text-purple-400">%{tahsilatOrani}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Başarı</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Staff Income */}
          <div className="xl:col-span-1 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-emerald-500" /> Danışman Bazında Gelir
            </h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="pb-3 text-slate-500 font-medium">Danışman</th>
                  <th className="pb-3 text-slate-500 font-medium text-right">Tahsil</th>
                  <th className="pb-3 text-slate-500 font-medium text-right">Bekleyen</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map(s => (
                  <tr key={s.name} className="border-b border-slate-100 dark:border-[#1f2937]/50 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors">
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{s.name} <span className="text-xs text-slate-400 font-normal">({s.customerCount.size} M)</span></td>
                    <td className="py-3 text-right text-emerald-500 font-semibold">₺{s.collected.toLocaleString('tr-TR')}</td>
                    <td className="py-3 text-right text-amber-500">₺{s.pending.toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
                {staffStats.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-slate-500">Veri bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Country Income */}
          <div className="xl:col-span-1 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Ülke Bazında Gelir
            </h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                  <th className="pb-3 text-slate-500 font-medium">Ülke</th>
                  <th className="pb-3 text-slate-500 font-medium text-right">Tahsil</th>
                  <th className="pb-3 text-slate-500 font-medium text-right">Bekleyen</th>
                </tr>
              </thead>
              <tbody>
                {countryIncomeStats.slice(0, 8).map(c => (
                  <tr key={c.country} className="border-b border-slate-100 dark:border-[#1f2937]/50 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors">
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{c.country} <span className="text-xs text-slate-400 font-normal">({c.apps} B)</span></td>
                    <td className="py-3 text-right text-emerald-500 font-semibold">₺{c.collected.toLocaleString('tr-TR')}</td>
                    <td className="py-3 text-right text-slate-500 dark:text-slate-400">₺{c.expected.toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
                {countryIncomeStats.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-slate-500">Veri bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* 6 Month Trend */}
          <div className="xl:col-span-1 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" /> Son 6 Ay Gelir Trendi
            </h3>
            <div className="space-y-4">
              {trendStats.map((t, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] hover:-translate-y-0.5 transition-transform">
                  <div className="font-medium text-slate-900 dark:text-white text-sm capitalize">{t.label}</div>
                  <div className="text-right text-xs">
                    <div className="text-emerald-500 font-bold text-sm">₺{t.collected.toLocaleString('tr-TR')}</div>
                    <div className="text-amber-500 mt-0.5">₺{t.pending.toLocaleString('tr-TR')} bekleyen</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STAFF PERFORMANCE */}
      {isAdmin && (
        <StaffPerformance data={staffPerfData} />
      )}

      {/* REJECTION ANALYSIS */}
      {isAdmin && (
        <RejectionAnalysis data={rejectedAppsData} />
      )}
    </div>
  );
}
