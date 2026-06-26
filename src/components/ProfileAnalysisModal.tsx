"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrainCircuit, X, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfileAnalysisModal({ customerId, currentScore, onClose }: { customerId: string, currentScore: number, onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createSupabaseBrowserClient();
  
  const [form, setForm] = useState({
    age: "",
    maritalStatus: "bekar",
    jobStatus: "calisan",
    monthlyIncome: "",
    travelHistory: "yok",
    hasProperty: "hayir",
  });

  const calculateScore = () => {
    let score = 30; // base score

    // Age
    const age = parseInt(form.age);
    if (age >= 25 && age <= 50) score += 10;
    else if (age > 50) score += 5;

    // Marital Status
    if (form.maritalStatus === "evli") score += 10;

    // Job Status
    if (form.jobStatus === "calisan") score += 15;
    else if (form.jobStatus === "isveren") score += 20;
    else if (form.jobStatus === "emekli") score += 15;
    else if (form.jobStatus === "ogrenci") score += 5; // requires sponsor

    // Income
    const income = parseInt(form.monthlyIncome);
    if (income >= 30000 && income < 60000) score += 10;
    else if (income >= 60000) score += 15;

    // Travel History
    if (form.travelHistory === "schengen") score += 20;
    else if (form.travelHistory === "diger") score += 10;

    // Properties
    if (form.hasProperty === "evet") score += 10;

    return Math.min(100, score);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");

    const newScore = calculateScore();

    const { error } = await supabase
      .from('customers')
      .update({ profile_score: newScore })
      .eq('id', customerId);

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert([{
      customer_id: customerId,
      action: `Yapay Zeka Profil Analizi yapıldı. Yeni Skor: ${newScore}/100`,
      performed_by: user?.email || 'Sistem',
    }]);

    setSaving(false);
    router.refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-500" /> AI Profil Analizi (Schengen)
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Yaş</label>
                <input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} placeholder="Örn: 32"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Medeni Hal</label>
                <select value={form.maritalStatus} onChange={e => setForm({...form, maritalStatus: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm focus:border-indigo-500 outline-none">
                  <option value="bekar">Bekar</option>
                  <option value="evli">Evli</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Çalışma Durumu</label>
                <select value={form.jobStatus} onChange={e => setForm({...form, jobStatus: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm focus:border-indigo-500 outline-none">
                  <option value="calisan">SGK&apos;lı Çalışan</option>
                  <option value="isveren">İşveren / Şirket Sahibi</option>
                  <option value="emekli">Emekli</option>
                  <option value="ogrenci">Öğrenci</option>
                  <option value="issiz">Çalışmıyor</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aylık Gelir (₺)</label>
                <input type="number" value={form.monthlyIncome} onChange={e => setForm({...form, monthlyIncome: e.target.value})} placeholder="Örn: 45000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Seyahat Geçmişi</label>
              <select value={form.travelHistory} onChange={e => setForm({...form, travelHistory: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm focus:border-indigo-500 outline-none">
                <option value="yok">Hiç yurtdışına çıkmadı</option>
                <option value="diger">Vizesiz ülkelere (Balkanlar, Kıbrıs vb.) gitti</option>
                <option value="schengen">Önceki Schengen/UK/US vizesi var</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Üzerine Kayıtlı Tapu/Araç var mı?</label>
              <select value={form.hasProperty} onChange={e => setForm({...form, hasProperty: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm focus:border-indigo-500 outline-none">
                <option value="hayir">Hayır</option>
                <option value="evet">Evet</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0a101a] border-t border-slate-200 dark:border-[#1f2937] flex justify-between items-center">
          <div className="text-xs text-slate-500">Mevcut Skor: <strong className="text-slate-700 dark:text-slate-300">{currentScore}</strong></div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:hover:bg-[#1f2937] rounded-lg transition-colors">
              İptal
            </button>
            <button onClick={handleSave} disabled={saving || !form.age || !form.monthlyIncome}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              Analiz Et ve Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
