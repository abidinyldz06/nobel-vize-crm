"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, X, AlertCircle } from "lucide-react";
import {
  APPLICATION_STATUS_META,
  APPLICATION_TRANSITIONS,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/application-status";

const REJECTION_REASONS = [
  { key: "gelir_yetersiz", label: "Gelir yetersiz / Şüpheli finansal tablo" },
  { key: "seyahat_gecmisi_yok", label: "Seyahat geçmişi zayıf / İlk vize" },
  { key: "sahte_belge", label: "Sahte / Hatalı / Şüpheli evrak beyanı" },
  { key: "ikna_edici_olmayan_amac", label: "İkna edici olmayan seyahat amacı" },
  { key: "sgk_borcu", label: "SGK veya Vergi borcu tespit edildi" },
  { key: "goc_riski", label: "Ülkesine geri dönmeme (Göç) riski yüksek" },
  { key: "diger", label: "Diğer (Açıklamada belirtiniz)" }
];

export default function StatusUpdater({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: string;
}) {
  const initialStatus: ApplicationStatus = isApplicationStatus(currentStatus) ? currentStatus : "profil_analizi";
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0].key);
  const [rejectionNote, setRejectionNote] = useState("");

  const router = useRouter();

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (!isApplicationStatus(newStatus) || newStatus === status) return;
    
    if (newStatus === "reddedildi") {
      setIsModalOpen(true);
      return;
    }

    await saveStatus(newStatus, null);
  };

  const saveStatus = async (newStatus: ApplicationStatus, reasonKey: string | null) => {
    setLoading(true);
    setIsModalOpen(false);

    let reasonText = null;
    if (reasonKey) {
      const label = REJECTION_REASONS.find(r => r.key === reasonKey)?.label || reasonKey;
      reasonText = rejectionNote ? `${label} - ${rejectionNote}` : label;
    }

    const supabase = createSupabaseBrowserClient();
    const oldStatusLabel = APPLICATION_STATUS_META[status].label;
    const newStatusLabel = APPLICATION_STATUS_META[newStatus].label;
    let actionLog = `Durum "${oldStatusLabel}" aşamasından "${newStatusLabel}" aşamasına değiştirildi`;
    if (reasonText) {
      actionLog += ` (Ret Sebebi: ${reasonText})`;
    }

    const { error } = await supabase.rpc("update_application_status_v1", {
      p_application_id: applicationId,
      p_status: newStatus,
      p_rejection_reason: reasonText ?? undefined,
      p_action: actionLog,
    });

    if (!error) {
      setStatus(newStatus);
      setRejectionNote("");
      router.refresh();
    } else {
      alert("Durum güncellenirken hata oluştu: " + error.message);
    }
    setLoading(false);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStatus("reddedildi", rejectionReason);
  };

  const availableStatuses = [status, ...APPLICATION_TRANSITIONS[status]];
  const current = APPLICATION_STATUS_META[status];

  return (
    <>
      <div className="relative inline-flex items-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500 dark:text-slate-400" />}
        <div className="relative">
          <select
            value={status}
            onChange={handleStatusChange}
            disabled={loading}
            className={`appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-700 bg-slate-800 text-sm font-medium cursor-pointer focus:outline-none focus:border-primary transition-colors disabled:opacity-50 ${current.color}`}
          >
            {availableStatuses.map(optionStatus => (
              <option key={optionStatus} value={optionStatus}>{APPLICATION_STATUS_META[optionStatus].label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-[#1f2937]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" /> Vize Reddi Analizi
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="p-5 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Lütfen vize reddinin ana sebebini seçin. Bu veri, gelecekteki danışmanlık süreçlerimizi iyileştirmek için raporlara yansıyacaktır.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ret Sebebi</label>
                <select 
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  {REJECTION_REASONS.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ek Açıklama (İsteğe Bağlı)</label>
                <textarea 
                  rows={3}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Konsolosluktan gelen mektuptaki spesifik madde veya notları buraya ekleyebilirsiniz..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  İptal
                </button>
                <button type="submit" className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-red-900/30 transition-all">
                  Reddedildi Olarak Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
