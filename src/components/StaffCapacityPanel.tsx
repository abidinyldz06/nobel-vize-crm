"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, SlidersHorizontal } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type StaffCapacityRow = {
  id: string;
  fullName: string;
  active: boolean;
  activeApplications: number;
  openTasks: number;
  maxActiveApplications: number;
  maxOpenTasks: number;
};

function capacityTone(actual: number, limit: number) {
  if (actual > limit) return "text-red-600 dark:text-red-400";
  if (actual >= Math.ceil(limit * 0.8)) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export default function StaffCapacityPanel({ initialRows }: { initialRows: StaffCapacityRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const supabase = createSupabaseBrowserClient();

  const changeLimit = (staffId: string, field: "maxActiveApplications" | "maxOpenTasks", value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return;
    setRows(current => current.map(row => row.id === staffId ? { ...row, [field]: parsed } : row));
  };

  const save = async (row: StaffCapacityRow) => {
    setSavingId(row.id);
    setError("");
    const { error: rpcError } = await supabase.rpc("set_staff_capacity_v1", {
      p_staff_id: row.id,
      p_max_active_applications: row.maxActiveApplications,
      p_max_open_tasks: row.maxOpenTasks,
    });
    if (rpcError) {
      setError("Kapasite limiti kaydedilemedi. Yönetici yetkinizi ve alanları kontrol edin.");
    }
    setSavingId(null);
  };

  return (
    <section className="mt-6 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex gap-3 items-start">
        <SlidersHorizontal className="w-4 h-4 text-blue-500 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kapasite ve iş yükü</h2>
          <p className="text-xs text-slate-500 mt-0.5">Limit aşımı, günlük operasyon çalıştığında danışmana uygulama içi uyarı olarak bildirilir.</p>
        </div>
      </div>
      {error && <p role="alert" className="mx-6 mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-[#1f2937]">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Danışman</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktif başvuru</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Açık görev</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#1f2937]">
            {rows.filter(row => row.active).map(row => {
              const overloaded = row.activeApplications > row.maxActiveApplications || row.openTasks > row.maxOpenTasks;
              return (
                <tr key={row.id}>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                    <span className="inline-flex items-center gap-2">
                      {overloaded && <AlertTriangle aria-label="Kapasite aşıldı" className="w-4 h-4 text-red-500" />}
                      {row.fullName}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-semibold ${capacityTone(row.activeApplications, row.maxActiveApplications)}`}>{row.activeApplications}</span>
                    <span className="text-slate-400"> / </span>
                    <input
                      aria-label={`${row.fullName} aktif başvuru limiti`}
                      type="number"
                      min="1"
                      max="250"
                      value={row.maxActiveApplications}
                      onChange={event => changeLimit(row.id, "maxActiveApplications", event.target.value)}
                      className="w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-semibold ${capacityTone(row.openTasks, row.maxOpenTasks)}`}>{row.openTasks}</span>
                    <span className="text-slate-400"> / </span>
                    <input
                      aria-label={`${row.fullName} açık görev limiti`}
                      type="number"
                      min="1"
                      max="500"
                      value={row.maxOpenTasks}
                      onChange={event => changeLimit(row.id, "maxOpenTasks", event.target.value)}
                      className="w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => save(row)}
                      disabled={savingId === row.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Kaydet
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
