import { Download, FileText, Timer, UsersRound } from "lucide-react";
import type { AdvancedReport } from "@/lib/advanced-report-data";

export default function AdvancedReportsPanel({ report }: { report: AdvancedReport }) {
  const query = new URLSearchParams({
    month: String(report.period.month),
    year: String(report.period.year),
  }).toString();

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gelişmiş Operasyon Raporları</h2>
          <p className="text-xs text-slate-500">Ekran ve dışa aktarımlar aynı yetkili veri setini ve dönem filtresini kullanır.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/reports/export.csv?${query}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Download className="h-4 w-4" /> CSV
          </a>
          <a href={`/api/reports/export.pdf?${query}`} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
            <FileText className="h-4 w-4" /> PDF
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={Timer} label="Geciken lead SLA" value={report.leadSla.overdue} detail={`${report.leadSla.dueSoon} takip 24 saat içinde`} />
        <Metric icon={UsersRound} label="Açık lead" value={report.leadSla.open} detail="Dönüşmeyen aktif fırsatlar" />
        <Metric icon={FileText} label="Sonuç satırı" value={report.resultRows.length} detail={report.period.label} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ReportTable title="Ülke / Vize Sonuçları" headers={["Ülke / Tür", "Onay", "Red", "Bekleyen"]}>
          {report.resultRows.map((row) => (
            <tr key={`${row.country}-${row.visaType}`} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 font-medium">{row.country}<span className="block text-[10px] text-slate-500">{row.visaType}</span></td>
              <td className="text-right text-emerald-600">{row.approved}</td><td className="text-right text-red-600">{row.rejected}</td><td className="text-right">{row.pending}</td>
            </tr>
          ))}
        </ReportTable>
        <ReportTable title="Bekleyen Tahsilat Yaşı" headers={["Yaş", "Adet", "Tutar"]}>
          {report.aging.map((row) => (
            <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 font-medium">{row.label}</td><td className="text-right">{row.count}</td><td className="text-right">₺{row.amount.toLocaleString("tr-TR")}</td>
            </tr>
          ))}
        </ReportTable>
        <ReportTable title="Danışman İş Yükü" headers={["Danışman", "Başvuru", "Lead", "Görev"]}>
          {report.workload.map((row) => (
            <tr key={row.staff} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 font-medium">{row.staff}</td><td className="text-right">{row.applications}</td><td className="text-right">{row.leads}</td><td className="text-right">{row.tasks}</td>
            </tr>
          ))}
        </ReportTable>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Timer; label: string; value: number; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1420]"><Icon className="h-5 w-5 text-blue-600" /><p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>;
}

function ReportTable({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-[#0d1420]">
      <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{title}</h3>
      <table className="w-full text-slate-700 dark:text-slate-300">
        <thead><tr className="text-left text-[10px] uppercase text-slate-500">{headers.map((header, index) => <th key={header} className={index > 0 ? "pb-2 text-right" : "pb-2"}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
