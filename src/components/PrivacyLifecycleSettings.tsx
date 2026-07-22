"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

export default function PrivacyLifecycleSettings({ settings }: { settings: Tables<"privacy_settings"> }) {
  const supabase = createSupabaseBrowserClient();
  const [customerDays, setCustomerDays] = useState(settings.customer_retention_days?.toString() ?? "");
  const [documentDays, setDocumentDays] = useState(settings.document_retention_days?.toString() ?? "");
  const [graceDays, setGraceDays] = useState(settings.archive_grace_days.toString());
  const [automatic, setAutomatic] = useState(settings.automatic_actions_enabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setMessage(null);
    const { error } = await supabase.rpc("update_privacy_settings_v1", { p_payload: { customer_retention_days: customerDays || null, document_retention_days: documentDays || null, archive_grace_days: graceDays, automatic_actions_enabled: automatic } });
    setMessage(error ? error.message : "Saklama politikası kaydedildi."); setSaving(false);
  };

  return <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]" data-testid="privacy-lifecycle-settings">
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-[#1f2937] dark:bg-[#0a101a]"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">Veri Saklama Politikası</h2><p className="mt-1 text-xs text-slate-500">Süreler kuruluş politikanızdır; yürürlüğe almadan önce hukuk ve operasyon onayı alın.</p></div>
    <div className="space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-slate-500">Müşteri kaydı (gün)<input aria-label="Müşteri Saklama Günü" type="number" min={30} value={customerDays} onChange={event => setCustomerDays(event.target.value)} placeholder="Tanımlanmadı" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-500">Evrak dosyası (gün)<input aria-label="Evrak Saklama Günü" type="number" min={30} value={documentDays} onChange={event => setDocumentDays(event.target.value)} placeholder="Tanımlanmadı" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-500">Arşiv bekleme (gün)<input aria-label="Arşiv Bekleme Günü" type="number" min={30} value={graceDays} onChange={event => setGraceDays(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input aria-label="Otomatik Yaşam Döngüsü" type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Otomatik yaşam döngüsü işlemlerini etkinleştir</label>
      <p className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="h-4 w-4 shrink-0" />Bu sürüm otomatik olarak veri silmez. Seçenek yalnız politika hazırlığını kaydeder; her silme ve anonimleştirme admin onayı, onaylanmış talep ve bekleme süresi ister.</p>
      {message && <p className="text-xs text-slate-500">{message}</p>}
      <div className="flex justify-end"><button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Politikayı kaydet</button></div>
    </div>
  </div>;
}
