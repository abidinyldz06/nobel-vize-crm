"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Award, Users, DollarSign, ExternalLink } from "lucide-react";

interface StaffPerf {
  id: string;
  name: string;
  totalCustomers: number;
  activeApps: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  revenue: number;
  avgProcessTimeDays: number | null;
}

export default function StaffPerformance({ data }: { data: StaffPerf[] }) {
  const [sortField, setSortField] = useState<keyof StaffPerf>("approvalRate");
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: keyof StaffPerf) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const valA = a[sortField] ?? 0;
    const valB = b[sortField] ?? 0;
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  // Leaderboard
  const topApproval = [...data].filter(d => d.approved + d.rejected > 0).sort((a, b) => b.approvalRate - a.approvalRate)[0];
  const topCustomers = [...data].sort((a, b) => b.totalCustomers - a.totalCustomers)[0];
  const topRevenue = [...data].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
        <Award className="w-5 h-5 text-blue-500" /> Danışman Performans Raporu
      </h2>

      {/* Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-0.5">En Yüksek Onay</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{topApproval?.name || "—"}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">% {topApproval?.approvalRate.toFixed(1) || 0} Onay Oranı</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mb-0.5">En Çok Müşteri</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{topCustomers?.name || "—"}</p>
            <p className="text-xs text-blue-600 dark:text-blue-500">{topCustomers?.totalCustomers || 0} Müşteri</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider mb-0.5">En Çok Gelir</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{topRevenue?.name || "—"}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">₺{topRevenue?.revenue.toLocaleString('tr-TR') || 0}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-[#0a101a] border-b border-slate-200 dark:border-[#1f2937]">
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Danışman</th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-[#1a2232] transition-colors" onClick={() => handleSort('totalCustomers')}>
                <div className="flex items-center gap-1">Müşteri <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-[#1a2232] transition-colors" onClick={() => handleSort('activeApps')}>
                <div className="flex items-center gap-1">Aktif Başvuru <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-[#1a2232] transition-colors" onClick={() => handleSort('approvalRate')}>
                <div className="flex items-center gap-1">Onay Oranı <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-[#1a2232] transition-colors" onClick={() => handleSort('revenue')}>
                <div className="flex items-center gap-1">Toplam Gelir <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">Ort. Süre</th>
              <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1f2937]/50">
            {sortedData.map(d => {
              let rateColor = "text-red-500";
              if (d.approvalRate >= 70) rateColor = "text-emerald-500";
              else if (d.approvalRate >= 40) rateColor = "text-amber-500";

              return (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-[#1a2232]/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                    {d.name}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {d.totalCustomers}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {d.activeApps}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${rateColor}`}>%{d.approvalRate.toFixed(1)}</span>
                    <div className="text-[10px] text-slate-500 mt-0.5">{d.approved} Onay / {d.rejected} Red</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-500">
                    ₺{d.revenue.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {d.avgProcessTimeDays ? `${Math.round(d.avgProcessTimeDays)} gün` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/staff/${d.id}/performance`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg">
                      Detay <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Danışman verisi bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
