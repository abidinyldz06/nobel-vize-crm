"use client"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, FileText, Plus, Loader2, AlertTriangle, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

type VisaHistory = {
  id: string;
  country: string;
  visa_type: string;
  status: string; // 'onay', 'ret'
  issue_date: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
};

export default function VisaHistoryPanel({ customerId, initialHistory }: { customerId: string; initialHistory: VisaHistory[] }) {
  const [history, setHistory] = useState<VisaHistory[]>(initialHistory);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const [form, setForm] = useState({
    country: "",
    visa_type: "Turist",
    status: "onay",
    issue_date: "",
    expiry_date: "",
    notes: ""
  });

  const handleAdd = async () => {
    if (!form.country || !form.issue_date) {
      setErrorMsg("Ülke ve Karar Tarihi zorunludur.");
      return;
    }
    setSaving(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("visa_history")
      .insert([{ 
        customer_id: customerId,
        country: form.country,
        visa_type: form.visa_type,
        status: form.status,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null
      }])
      .select()
      .single();

    if (!error && data) {
      setHistory(prev => [data, ...prev]);
      setForm({ country: "", visa_type: "Turist", status: "onay", issue_date: "", expiry_date: "", notes: "" });
      setShowForm(false);
      router.refresh();
    } else {
      setErrorMsg(error?.message || "Bilinmeyen hata");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" /> Vize Geçmişi
        </h3>
        <button
          onClick={() => { setShowForm(!showForm); setErrorMsg(""); }}
          className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
        >
          {showForm ? "İptal" : "+ Vize Ekle"}
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50/50 dark:bg-[#0a101a]/50">
          {errorMsg && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-400 font-semibold">{errorMsg}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={form.country}
              onChange={e => setForm({...form, country: e.target.value})}
              placeholder="Ülke (Örn: Almanya)"
              className="px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={form.visa_type}
              onChange={e => setForm({...form, visa_type: e.target.value})}
              placeholder="Vize Türü (Örn: Turist)"
              className="px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Karar Tarihi</label>
              <input
                type="date"
                value={form.issue_date}
                onChange={e => setForm({...form, issue_date: e.target.value})}
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Bitiş Tarihi (Opsiyonel)</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => setForm({...form, expiry_date: e.target.value})}
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <select
            value={form.status}
            onChange={e => setForm({...form, status: e.target.value})}
            className="w-full mb-3 px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="onay">Onaylandı</option>
            <option value="ret">Reddedildi</option>
          </select>

          <input
            type="text"
            value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Not (Örn: 9. Maddeden ret, 1 yıllık vize vb.)"
            className="w-full mb-3 px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition-all"
          />

          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 shadow-lg shadow-emerald-900/30"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Ekle
            </button>
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-[#1f2937]">
        {history.length > 0 ? history.map(item => (
          <div key={item.id} className="px-5 py-3.5 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.status === 'onay' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
              {item.status === 'onay' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.country}</span>
                <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-200 dark:bg-[#1f2937] rounded-md">{item.visa_type}</span>
              </div>
              <div className="text-[10px] text-slate-500 mb-1">
                Tarih: {new Date(item.issue_date).toLocaleDateString('tr-TR')} 
                {item.expiry_date && ` - Bitiş: ${new Date(item.expiry_date).toLocaleDateString('tr-TR')}`}
              </div>
              {item.notes && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{item.notes}</p>
              )}
            </div>
          </div>
        )) : (
          <div className="px-5 py-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Vize geçmişi bulunmuyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
