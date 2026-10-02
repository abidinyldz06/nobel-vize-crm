"use client";

import { useEffect, useState } from "react";
import type { DataQualitySummary } from "@/lib/data-quality-summary";

export default function DataQualityPanel({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<DataQualitySummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch("/api/tasks/data-quality", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.summary) throw new Error("quality_unavailable");
        if (!controller.signal.aborted) setSummary(payload.summary);
      } catch {
        if (!controller.signal.aborted) { setSummary(null); setError(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, retry]);

  return (
    <section aria-labelledby="quality-title" data-testid="data-quality-panel" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1f2937] dark:bg-[#0d1420]">
      <h2 id="quality-title" className="font-semibold text-slate-900 dark:text-white">Veri kalite özeti</h2>
      <p className="mt-1 text-xs text-slate-500">Salt okunur ölçüm; görev oluşturmaz veya müşteri verisini değiştirmez.</p>
      {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Ölçüm hazırlanıyor...</p> : error ? (
        <div role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">
          <p>Özet okunamadı. Bu durum sıfır eksiklik anlamına gelmez.</p>
          <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 rounded-lg border px-3 py-2">Özeti yeniden dene</button>
        </div>
      ) : summary && (
        <>
          <dl className="my-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            {[
              ["Aktif müşteri", summary.activeCustomers], ["Açık başvuru", summary.openApplications],
              ["Eksik alan kontrolü", summary.missingFields], ["Geciken veri görevi", summary.queue.overdue],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-[#060c18]"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{value}</dd></div>)}
          </dl>
          {summary.insufficientSample && <p className="mb-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Aktif müşterilere bağlı açık başvuru yok; operasyon başarısı için yeterli veri yok. Sıfır eksiklik, bir haftalık kabulün tamamlandığı anlamına gelmez.</p>}
          {summary.archivedOpenApplications > 0 && <p role="alert" data-testid="archived-open-applications" className="mb-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Arşivlenmiş müşterilere bağlı {summary.archivedOpenApplications} kapanmamış başvuru var. Bunlar aktif veri taramasına dahil değildir; kayıtları otomatik açmadan veya kapatmadan inceleyin.</p>}
          <div tabIndex={0} role="region" aria-label="Veri kalite kontrol tablosu" className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <caption className="sr-only">Kategori bazlı eksiklik ve görev kapsamı</caption>
              <thead><tr>{["Kontrol", "Eksik", "Açık görevde", "Görev yok", "Tamamlandı ama eksik", "Susturulan", "Takip süresi"].map(label => <th scope="col" key={label} className="whitespace-nowrap p-2">{label}</th>)}</tr></thead>
              <tbody>{summary.categories.map(category => <tr key={category.key} className="border-t border-slate-100 dark:border-[#1f2937]"><th scope="row" className="p-2 font-medium">{category.label}</th>{[category.missing, category.queued, category.neverQueued, category.completedStillMissing, category.suppressed, `${category.days} gün`].map((value, index) => <td key={index} className="p-2">{value}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Açık veri görevleri: {summary.queue.open} · Aktif sorumlusu olmayan: {summary.queue.inactiveOwner} · Yeniden taramada kapanma adayı: {summary.queue.stale} · Son 7 günde tamamlanan: {summary.queue.completedLast7Days}</p>
          <p className="mt-2 text-xs text-slate-500">İletişim kontrolü en az bir kanal arar. Süreler mevcut 1/3/7 günlük takip kurallarıdır. Görev kapanışı Veri Kontrolü yeniden çalıştırıldığında değerlendirilir.</p>
          <p className="mt-2 text-xs text-slate-500">Ölçüm: {new Date(summary.measuredAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (Türkiye saati). Özet, görev listesinin 250 kayıt sınırından bağımsızdır; eşzamanlı değişiklikler sırasında anlık görünüm farklılaşabilir.</p>
        </>
      )}
    </section>
  );
}
