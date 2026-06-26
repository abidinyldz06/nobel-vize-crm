"use client";

import { TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Target, CalendarDays, Calculator } from "lucide-react";

interface Metrics {
  customers: number;
  apps: number;
  revenue: number;
  approved: number;
}

interface RevenueProjectionProps {
  activeAppsCount: number;
  expectedRevenue: number;
  avgProcessDays: number;
  thisMonth: Metrics;
  lastMonth: Metrics;
  yearly: {
    customers: number;
    apps: number;
    revenue: number;
    monthsCount: number;
  };
}

export default function RevenueProjection({
  activeAppsCount,
  expectedRevenue,
  avgProcessDays,
  thisMonth,
  lastMonth,
  yearly
}: RevenueProjectionProps) {
  
  const renderTrend = (current: number, past: number, format: 'number' | 'currency' = 'number') => {
    const diff = current - past;
    const isPositive = diff >= 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const color = isPositive ? "text-emerald-500" : "text-red-500";
    const bg = isPositive ? "bg-emerald-500/10" : "bg-red-500/10";
    
    let displayDiff = "";
    if (format === 'currency') {
      displayDiff = `₺${Math.abs(diff).toLocaleString('tr-TR')}`;
    } else {
      displayDiff = Math.abs(diff).toString();
    }

    if (past === 0 && current > 0) return <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${color} ${bg}`}><Icon className="w-3 h-3" /> %100</span>;
    if (past === 0 && current === 0) return <span className="text-slate-400 text-xs">-</span>;

    const percent = Math.abs(Math.round((diff / past) * 100));

    return (
      <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${color} ${bg}`} title={`${isPositive ? '+' : '-'}${displayDiff}`}>
        <Icon className="w-3 h-3" /> %{percent}
      </span>
    );
  };

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-indigo-500" /> Gelir Projeksiyonu & Hedefler
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Active Expected */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Calculator className="w-16 h-16 text-indigo-500" />
          </div>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wider relative z-10">Aktif Beklenen Gelir</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white relative z-10">₺{expectedRevenue.toLocaleString('tr-TR')}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 relative z-10 font-medium">Sistemdeki {activeAppsCount} aktif başvurunun toplamı.</p>
        </div>

        {/* Projection */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="w-16 h-16 text-purple-500" />
          </div>
          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1 uppercase tracking-wider relative z-10">Tahmini Nakit Akışı</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white relative z-10">~{avgProcessDays} Gün</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 relative z-10 font-medium">Aktif başvuruların ortalama sonuçlanma süresi.</p>
        </div>

        {/* This Month vs Last Month */}
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg xl:col-span-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Bu Ay / Geçen Ay Karşılaştırması
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Müşteri</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold text-slate-900 dark:text-white">{thisMonth.customers}</span>
                {renderTrend(thisMonth.customers, lastMonth.customers)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Geçen: {lastMonth.customers}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Başvuru</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold text-slate-900 dark:text-white">{thisMonth.apps}</span>
                {renderTrend(thisMonth.apps, lastMonth.apps)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Geçen: {lastMonth.apps}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Onay</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold text-slate-900 dark:text-white">{thisMonth.approved}</span>
                {renderTrend(thisMonth.approved, lastMonth.approved)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Geçen: {lastMonth.approved}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Tahsilat</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-bold text-emerald-500">₺{(thisMonth.revenue / 1000).toFixed(1)}k</span>
                {renderTrend(thisMonth.revenue, lastMonth.revenue, 'currency')}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Geçen: ₺{(lastMonth.revenue / 1000).toFixed(1)}k</p>
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Summary */}
      <div className="bg-slate-50 dark:bg-[#0a101a] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Yıllık Özet (Bu Yıl)</h4>
            <p className="text-xs text-slate-500 mt-0.5">Yıl başından bu yana genel performans metrikleri.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap sm:flex-nowrap gap-4 sm:gap-8 text-center divide-x divide-slate-200 dark:divide-[#1f2937] overflow-x-auto w-full md:w-auto">
          <div className="pl-4 sm:pl-8 first:pl-0">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{yearly.customers}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Toplam Müşteri</p>
          </div>
          <div className="pl-4 sm:pl-8">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{yearly.apps}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Toplam Başvuru</p>
          </div>
          <div className="pl-4 sm:pl-8">
            <p className="text-xl font-bold text-emerald-500">₺{yearly.revenue.toLocaleString('tr-TR')}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Toplam Tahsilat</p>
          </div>
          <div className="pl-4 sm:pl-8">
            <p className="text-xl font-bold text-blue-500">{Math.round(yearly.apps / Math.max(1, yearly.monthsCount))}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Aylık Ort. Başvuru</p>
          </div>
        </div>
      </div>
    </div>
  );
}
