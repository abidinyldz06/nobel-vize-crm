"use client";

import { useState } from "react";
import { Check, Edit3, FileText, Loader2, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

type Notice = Tables<"privacy_notice_versions">;

const emptyForm = () => ({
  id: crypto.randomUUID(),
  version: "",
  title: "",
  content: "",
  effectiveAt: new Date().toISOString().slice(0, 16),
  isActive: false,
});

export default function PrivacyNoticeSettings({ initialNotices }: { initialNotices: Notice[] }) {
  const supabase = createSupabaseBrowserClient();
  const [notices, setNotices] = useState(initialNotices);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editNotice = (notice: Notice) => {
    setForm({
      id: notice.id,
      version: notice.version,
      title: notice.title,
      content: notice.content,
      effectiveAt: new Date(notice.effective_at).toISOString().slice(0, 16),
      isActive: notice.is_active,
    });
    setMessage(null);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!form.version.trim() || !form.title.trim() || !form.content.trim()) {
        throw new Error("Sürüm, başlık ve metin zorunludur.");
      }
      const { error: saveError } = await supabase.rpc("upsert_privacy_notice_v1", {
        p_notice_id: form.id,
        p_payload: {
          version: form.version.trim(),
          title: form.title.trim(),
          content: form.content.trim(),
          effective_at: new Date(form.effectiveAt).toISOString(),
          is_active: form.isActive,
        },
      });
      if (saveError) throw saveError;
      const { data, error: reloadError } = await supabase
        .from("privacy_notice_versions")
        .select("*")
        .order("effective_at", { ascending: false });
      if (reloadError) throw reloadError;
      setNotices(data ?? []);
      setForm(emptyForm());
      setMessage("Aydınlatma metni sürümü kaydedildi.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : typeof caught === "object" && caught && "message" in caught ? String(caught.message) : "Kayıt başarısız oldu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="privacy-notice-settings">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-[#1f2937] dark:bg-[#0a101a]">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <FileText className="h-4 w-4 text-blue-500" /> KVKK Aydınlatma Metinleri
          </h2>
          <p className="mt-1 text-xs text-slate-500">Her değişikliği yeni bir sürüm olarak saklayın. Metni yayınlamadan önce hukuk danışmanınızla doğrulayın.</p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}
          {message && <p className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-500"><Check className="h-4 w-4" />{message}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              Sürüm
              <input aria-label="Aydınlatma Sürümü" value={form.version} onChange={(event) => setForm(current => ({ ...current, version: event.target.value }))} placeholder="2026.1" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              Yürürlük zamanı
              <input aria-label="Yürürlük Zamanı" type="datetime-local" value={form.effectiveAt} onChange={(event) => setForm(current => ({ ...current, effectiveAt: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-500">
            Başlık
            <input aria-label="Aydınlatma Başlığı" value={form.title} onChange={(event) => setForm(current => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-500">
            Metin
            <textarea aria-label="Aydınlatma Metni" rows={10} value={form.content} onChange={(event) => setForm(current => ({ ...current, content: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input aria-label="Aydınlatma Aktif" type="checkbox" checked={form.isActive} onChange={(event) => setForm(current => ({ ...current, isActive: event.target.checked }))} />
            Müşteri kayıtlarında kullanılabilir
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(emptyForm())} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-[#1f2937] dark:text-slate-300"><Plus className="h-4 w-4" />Yeni sürüm</button>
            <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Kaydet</button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-500 dark:border-[#1f2937]">Sürüm geçmişi</div>
        {notices.length === 0 ? <p className="p-5 text-sm text-slate-500">Henüz aydınlatma metni yok.</p> : notices.map(notice => (
          <button key={notice.id} type="button" onClick={() => editNotice(notice)} className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-4 text-left last:border-0 hover:bg-slate-50 dark:border-[#1f2937] dark:hover:bg-[#111a28]">
            <div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notice.version} · {notice.title}</p><p className="mt-1 text-xs text-slate-500">{new Date(notice.effective_at).toLocaleString("tr-TR")} · {notice.is_active ? "Aktif" : "Pasif"}</p></div>
            <Edit3 className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
