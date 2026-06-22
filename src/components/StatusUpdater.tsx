"use client"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { key: "profil_analizi", label: "Profil Analizi", color: "text-slate-500 dark:text-slate-400" },
  { key: "evrak_bekleniyor", label: "Evrak Bekleniyor", color: "text-amber-500" },
  { key: "randevu_bekleniyor", label: "Randevu Bekleniyor", color: "text-orange-500" },
  { key: "randevu_alindi", label: "Randevu Alındı", color: "text-blue-400" },
  { key: "evrak_hazirlaniyor", label: "Evrak Hazırlanıyor", color: "text-indigo-400" },
  { key: "basvuru_yapildi", label: "Başvuru Yapıldı", color: "text-purple-400" },
  { key: "onaylandi", label: "Onaylandı ✓", color: "text-emerald-500" },
  { key: "reddedildi", label: "Reddedildi ✗", color: "text-red-400" },
  { key: "itiraz", label: "İtiraz", color: "text-yellow-500" },
  { key: "kapandi", label: "Kapandı", color: "text-slate-600 dark:text-slate-400" },
];

export default function StatusUpdater({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setLoading(true);
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const oldStatusLabel = STATUS_OPTIONS.find(o => o.key === status)?.label || status;
      const newStatusLabel = STATUS_OPTIONS.find(o => o.key === newStatus)?.label || newStatus;
      
      await supabase.from("activity_log").insert([{
        application_id: applicationId,
        action: `Durum "${oldStatusLabel}" aşamasından "${newStatusLabel}" aşamasına değiştirildi`,
        performed_by: user?.email || "Danışman"
      }]);

      setStatus(newStatus);
      router.refresh();
    } else {
      alert("Durum güncellenirken hata oluştu: " + error.message);
    }
    setLoading(false);
  };

  const current = STATUS_OPTIONS.find(o => o.key === status);

  return (
    <div className="relative inline-flex items-center gap-2">
      {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400" />}
      <div className="relative">
        <select
          value={status}
          onChange={handleChange}
          disabled={loading}
          className={`appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-700 bg-slate-800 text-sm font-medium cursor-pointer focus:outline-none focus:border-primary transition-colors disabled:opacity-50 ${current?.color}`}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}
