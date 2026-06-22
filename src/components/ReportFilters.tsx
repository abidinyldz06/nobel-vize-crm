"use client"
import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

export default function ReportFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentMonth = searchParams.get('month') || String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYear = searchParams.get('year') || String(new Date().getFullYear());

  const handleFilterChange = (month: string, year: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', month);
    params.set('year', year);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 mb-0.5">
      <Filter className="w-4 h-4 text-slate-500" />
      <select 
        value={currentMonth} 
        onChange={e => handleFilterChange(e.target.value, currentYear)}
        className="px-2 py-1 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <option key={i+1} value={String(i+1).padStart(2, '0')}>
            {new Date(2000, i, 1).toLocaleString('tr-TR', { month: 'long' })}
          </option>
        ))}
      </select>
      <select 
        value={currentYear} 
        onChange={e => handleFilterChange(currentMonth, e.target.value)}
        className="px-2 py-1 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
      >
        {[2024, 2025, 2026, 2027].map(y => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}
