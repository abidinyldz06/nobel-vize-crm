"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, UserX, X } from "lucide-react";

const options = [
  { value: "completed", label: "Tamamlandı", icon: Check },
  { value: "no_show", label: "Gelmedi", icon: UserX },
  { value: "cancelled", label: "İptal", icon: X },
] as const;

export default function AppointmentActions({ id, status }: { id: string; status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(nextStatus: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/appointments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) setError(result.error ?? "Durum güncellenemedi.");
    else router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
      <a href={`/api/appointments/${id}/ics`} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        <Download className="h-3 w-3" /> ICS
      </a>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          disabled={busy || status === value}
          onClick={() => update(value)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Icon className="h-3 w-3" /> {label}
        </button>
      ))}
      {error && <span className="w-full text-right text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
