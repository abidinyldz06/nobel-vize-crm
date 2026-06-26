"use client";

import { useState } from "react";
import { Table } from "lucide-react";

interface AppData {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string;
  customers: any;
}

export default function VisaSuccessMatrix({ data, staffList }: { data: AppData[], staffList: any[] }) {
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("all"); // all, this_month, last_3_months

  // Filter data
  const filteredData = data.filter(a => {
    if (selectedStaff !== "all") {
      const staffId = Array.isArray(a.customers) ? a.customers[0]?.assigned_staff_id : a.customers?.assigned_staff_id;
      if (staffId !== selectedStaff) return false;
    }
    
    if (timeRange !== "all") {
      const appDate = new Date(a.created_at);
      const now = new Date();
      if (timeRange === "this_month") {
        if (appDate.getMonth() !== now.getMonth() || appDate.getFullYear() !== now.getFullYear()) return false;
      } else if (timeRange === "last_3_months") {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        if (appDate < threeMonthsAgo) return false;
      }
    }
    return true;
  });

  // Build Matrix
  const matrix: Record<string, Record<string, { total: number, approved: number, rejected: number }>> = {};
  const visaTypes = new Set<string>();

  filteredData.forEach(a => {
    if (!a.country || !a.visa_type) return;
    const c = a.country;
    const v = a.visa_type;
    
    visaTypes.add(v);
    
    if (!matrix[c]) matrix[c] = {};
    if (!matrix[c][v]) matrix[c][v] = { total: 0, approved: 0, rejected: 0 };
    
    matrix[c][v].total++;
    if (a.status === 'onaylandi') matrix[c][v].approved++;
    if (a.status === 'reddedildi') matrix[c][v].rejected++;
  });

  const countries = Object.keys(matrix).sort();
  const vTypes = Array.from(visaTypes).sort();

  return (
    <div className="mt-10 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-indigo-500" /> Vize Başarı Oranı Matrisi
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Ülke ve vize türüne göre detaylı onay oranları.</p>
        </div>
        
        <div className="flex gap-2">
          <select 
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Tüm Danışmanlar</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">Tüm Zamanlar (Son 6 Ay)</option>
            <option value="this_month">Bu Ay</option>
            <option value="last_3_months">Son 3 Ay</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <th className="px-4 py-3 text-slate-500 font-semibold sticky left-0 bg-slate-50 dark:bg-[#0a101a] z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Ülke</th>
              {vTypes.map(v => (
                <th key={v} className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap text-center capitalize">
                  {v.replace('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1f2937]/50">
            {countries.map(c => (
              <tr key={c} className="hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-[#0d1420] group-hover:bg-slate-50 dark:group-hover:bg-[#1a2232] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                  {c}
                </td>
                {vTypes.map(v => {
                  const cell = matrix[c][v];
                  if (!cell || cell.total === 0) {
                    return <td key={v} className="px-4 py-3 text-center text-slate-400 dark:text-slate-600 font-medium">—</td>;
                  }
                  const decided = cell.approved + cell.rejected;
                  const rate = decided > 0 ? (cell.approved / decided) * 100 : 0;
                  
                  let colorClass = "text-slate-500 bg-slate-100 dark:bg-slate-800/50";
                  if (decided > 0) {
                    if (rate >= 70) colorClass = "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10";
                    else if (rate >= 40) colorClass = "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/10";
                    else colorClass = "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/10";
                  }

                  return (
                    <td key={v} className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${colorClass}`}>
                          {decided > 0 ? `%${rate.toFixed(0)}` : 'Belli Değil'}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1">
                          {cell.approved}/{cell.total} Onay
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {countries.length === 0 && (
              <tr>
                <td colSpan={vTypes.length + 1} className="px-4 py-8 text-center text-slate-500">Bu filtrelere uygun vize başvurusu bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
