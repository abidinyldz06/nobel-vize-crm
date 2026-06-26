"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AlertTriangle, Lightbulb } from "lucide-react";

interface RejectedApp {
  rejection_reason: string;
  country: string;
  visa_type: string;
}

const REJECTION_LABELS: Record<string, string> = {
  gelir_yetersiz: "Gelir yetersiz",
  seyahat_gecmisi_yok: "Seyahat geçmişi zayıf",
  sahte_belge: "Şüpheli / Hatalı belge",
  ikna_edici_olmayan_amac: "İkna edici olmayan amaç",
  sgk_borcu: "SGK / Vergi borcu",
  goc_riski: "Göç riski",
  diger: "Diğer"
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#ec4899", "#3b82f6", "#64748b"];

export default function RejectionAnalysis({ data }: { data: RejectedApp[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="mt-10 p-6 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Vize Reddi Analizi
        </h2>
        <div className="text-slate-500 text-sm text-center py-8 border border-dashed border-slate-200 dark:border-[#1f2937] rounded-xl">
          Henüz analiz edilebilecek vize reddi verisi bulunmuyor.
        </div>
      </div>
    );
  }

  // 1. Reason Distribution
  const reasonMap: Record<string, number> = {};
  data.forEach(app => {
    if (app.rejection_reason) {
      reasonMap[app.rejection_reason] = (reasonMap[app.rejection_reason] || 0) + 1;
    }
  });

  const pieData = Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value], index) => ({
      name: REJECTION_LABELS[key] || key,
      value,
      color: COLORS[index % COLORS.length]
    }));

  // 2. Country x Reason
  const countryReasonMap: Record<string, Record<string, number>> = {};
  data.forEach(app => {
    if (app.country && app.rejection_reason) {
      if (!countryReasonMap[app.country]) countryReasonMap[app.country] = { total: 0 };
      countryReasonMap[app.country][app.rejection_reason] = (countryReasonMap[app.country][app.rejection_reason] || 0) + 1;
      countryReasonMap[app.country].total += 1;
    }
  });

  const countryStats = Object.entries(countryReasonMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5); // Top 5 countries

  // 3. Generate Insight
  let insight = "Henüz yeterli veri yok.";
  if (data.length > 0) {
    const topReason = pieData[0];
    const topCountry = countryStats[0];
    
    if (topCountry) {
      const topCountryReasonEntry = Object.entries(topCountry[1])
        .filter(([k]) => k !== 'total')
        .sort((a, b) => b[1] - a[1])[0];
      
      if (topCountryReasonEntry) {
        const countryName = topCountry[0];
        const reasonName = REJECTION_LABELS[topCountryReasonEntry[0]] || topCountryReasonEntry[0];
        const count = topCountryReasonEntry[1];
        const percentage = Math.round((count / topCountry[1].total) * 100);
        
        insight = `${countryName} vizelerinde en yaygın red sebebi "${reasonName}" (%${percentage}). Bu ülkeye başvuran müşterilerde bu kritere özellikle dikkat edilmeli.`;
      }
    }
  }

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-red-500" /> Vize Reddi Analizi
      </h2>

      {/* Insight Card */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-5 rounded-2xl flex gap-4 mb-6">
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Yapay Zeka Önerisi</p>
          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{insight}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Ret Sebepleri Dağılımı</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => [value + ' Başvuru', 'Sayı']}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table: Country vs Reasons */}
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-6 rounded-2xl shadow-lg overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Ülke Bazında En Sık Görülen Retler</h3>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1f2937]">
                <th className="pb-3 text-slate-500 font-medium">Ülke</th>
                <th className="pb-3 text-slate-500 font-medium">1. Sebep</th>
                <th className="pb-3 text-slate-500 font-medium text-right">Toplam Ret</th>
              </tr>
            </thead>
            <tbody>
              {countryStats.map(([country, reasons]) => {
                const topReasonEntry = Object.entries(reasons)
                  .filter(([k]) => k !== 'total')
                  .sort((a, b) => b[1] - a[1])[0];
                  
                return (
                  <tr key={country} className="border-b border-slate-100 dark:border-[#1f2937]/50 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{country}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {topReasonEntry ? (
                        <span className="flex items-center gap-1">
                          <span className="text-red-500 font-medium">{topReasonEntry[1]}</span> × {REJECTION_LABELS[topReasonEntry[0]] || topReasonEntry[0]}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 text-right font-bold text-red-500">{reasons.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
