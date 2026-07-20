"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, Check, Clock, Loader2, Banknote, X } from "lucide-react";
import type { Tables } from "@/types/database";

type Payment = Tables<'payments'>;

const TYPE_LABELS: Record<string, string> = {
  upfront:   "Peşinat",
  remaining: "Kalan Ödeme",
  extra:     "Ek Ödeme",
};

const METHOD_LABELS: Record<string, string> = {
  nakit:        "Nakit",
  havale:       "Havale/EFT",
  kredi_karti:  "Kredi Kartı",
  iyzico:       "İyzico",
};

export default function PaymentsPanel({
  applicationId,
  totalFee,
  consulateFee = 0,
  serviceFee = 0,
  initialPayments,
}: {
  applicationId: string;
  totalFee: number;
  consulateFee?: number;
  serviceFee?: number;
  initialPayments: Payment[];
}) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    amount: "",
    type: "upfront",
    method: "nakit",
    currency: "TRY",
    note: "",
  });
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const totalPaid = payments
    .filter(p => p.status === "alindi")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const progress = totalFee > 0 ? Math.min(100, (totalPaid / totalFee) * 100) : 0;
  const remaining = Math.max(0, totalFee - totalPaid);

  const handleAdd = async () => {
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setErrorMsg("Lütfen geçerli bir tutar girin.");
      return;
    }
    setErrorMsg("");
    setSaving(true);

    const { data, error } = await supabase
      .from("payments")
      .insert([{
        application_id: applicationId,
        amount: amt,
        currency: form.currency,
        type: form.type,
        method: form.method,
        status: "alindi",
        note: form.note || null,
      }])
      .select()
      .single();

    if (!error && data) {
      setPayments(prev => [data, ...prev]);
      setForm({ amount: "", type: "upfront", method: "nakit", currency: "TRY", note: "" });
      setShowForm(false);
      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_log").insert([{
        application_id: applicationId,
        action: `Ödeme alındı: ₺${amt.toLocaleString('tr-TR')} (${TYPE_LABELS[form.type] || form.type} — ${METHOD_LABELS[form.method] || form.method})`,
        performed_by: user?.email || "Danışman",
      }])
      router.refresh();
    } else {
      setErrorMsg("Ödeme kaydedilemedi: " + (error?.message || "Bilinmeyen hata. Payments tablosunu oluşturduğunuzdan emin olun."));
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" /> Ödemeler ve Ücret
          </h3>
          {(consulateFee > 0 || serviceFee > 0) && (
            <p className="text-[10px] text-slate-500 mt-1">
              Harç: ₺{consulateFee.toLocaleString('tr-TR')} · Ofis: ₺{serviceFee.toLocaleString('tr-TR')}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setErrorMsg(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Ödeme Ekle
        </button>
      </div>

      {/* Summary */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Toplam: <span className="text-emerald-400">%{progress.toFixed(0)} Ödendi</span>
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            ₺{totalPaid.toLocaleString('tr-TR')}
            <span className="text-slate-500 font-normal"> / ₺{totalFee.toLocaleString('tr-TR')}</span>
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-emerald-400 font-medium">₺{totalPaid.toLocaleString('tr-TR')} alındı</span>
          <span className={`font-medium ${remaining > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {remaining > 0 ? `₺${remaining.toLocaleString('tr-TR')} kalan` : "✓ Tamamlandı"}
          </span>
        </div>
      </div>

      {/* Add Payment Form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-blue-600/5">
          <p className="text-xs font-semibold text-blue-400 mb-3 uppercase tracking-wider">Yeni Ödeme Kaydı</p>

          {errorMsg && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
              <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-[11px] text-red-400">{errorMsg}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Tutar *</label>
              <input
                type="number"
                min="1"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Örn: 7500"
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Para Birimi</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="TRY">₺ TL</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Tür</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="upfront">Peşinat</option>
                <option value="remaining">Kalan Ödeme</option>
                <option value="extra">Ek Ödeme</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Ödeme Yöntemi</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="nakit">💵 Nakit</option>
                <option value="havale">🏦 Havale/EFT</option>
                <option value="kredi_karti">💳 Kredi Kartı</option>
                <option value="iyzico">📱 İyzico</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Not (isteğe bağlı)</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Açıklama..."
                className="w-full px-3 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.amount}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Ödemeyi Kaydet
            </button>
            <button onClick={() => { setShowForm(false); setErrorMsg(""); }} className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 text-xs transition-colors">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="divide-y divide-slate-200 dark:divide-[#1f2937] max-h-48 overflow-y-auto">
        {payments.length > 0 ? payments.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              p.status === "alindi" ? "bg-emerald-500/10" : "bg-amber-500/10"
            }`}>
              {p.status === "alindi"
                ? <Check className="w-4 h-4 text-emerald-400" />
                : <Clock className="w-4 h-4 text-amber-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">₺{Number(p.amount).toLocaleString('tr-TR')}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  p.status === "alindi" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                }`}>{p.status === "alindi" ? "Alındı ✓" : "Bekliyor"}</span>
              </div>
              <p className="text-[10px] text-slate-500">
                {TYPE_LABELS[p.type] || p.type} · {METHOD_LABELS[p.method ?? ''] || p.method || 'Belirtilmedi'}
                {` · ${new Date(p.created_at).toLocaleDateString('tr-TR')}`}
                {p.note && ` · ${p.note}`}
              </p>
            </div>
          </div>
        )) : (
          <div className="px-5 py-8 text-center text-slate-600 text-xs">
            <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Henüz ödeme kaydı yok.
          </div>
        )}
      </div>
    </div>
  );
}
