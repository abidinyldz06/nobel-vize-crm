"use client";

import { useMemo, useState } from "react";
import { Check, Edit3, Loader2, Mail, MessageCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  MESSAGE_TEMPLATE_VARIABLES,
  unknownMessageTemplateVariables,
} from "@/lib/message-templates";
import type { Tables } from "@/types/database";

type MessageTemplate = Tables<"message_templates">;
type TemplateForm = Pick<MessageTemplate, "name" | "channel" | "subject_template" | "body_template" | "is_active">;

const emptyForm: TemplateForm = {
  name: "",
  channel: "whatsapp",
  subject_template: null,
  body_template: "",
  is_active: true,
};

export default function MessageTemplatesSettings({ initialTemplates }: { initialTemplates: MessageTemplate[] }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      channel: template.channel,
      subject_template: template.subject_template,
      body_template: template.body_template,
      is_active: template.is_active,
    });
  };

  const save = async () => {
    const unknownVariables = unknownMessageTemplateVariables(`${form.subject_template ?? ""}\n${form.body_template}`);
    if (!form.name.trim() || !form.body_template.trim()) {
      toast.error("Şablon adı ve mesaj gövdesi zorunludur.");
      return;
    }
    if (form.channel === "email" && !form.subject_template?.trim()) {
      toast.error("E-posta şablonunda konu zorunludur.");
      return;
    }
    if (unknownVariables.length > 0) {
      toast.error(`Bilinmeyen değişken: ${unknownVariables.join(", ")}`);
      return;
    }

    setSaving(true);
    const targetId = editingId ?? crypto.randomUUID();
    const { data, error } = await supabase.rpc("upsert_message_template_v1", {
      p_template_id: targetId,
      p_payload: {
        name: form.name.trim(),
        channel: form.channel,
        subject_template: form.channel === "email" ? form.subject_template?.trim() : null,
        body_template: form.body_template.trim(),
        is_active: form.is_active,
      },
    });
    setSaving(false);

    if (error || !data) {
      toast.error(error?.message ?? "Şablon kaydedilemedi.");
      return;
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("message_templates")
      .select("*")
      .order("channel")
      .order("name");
    if (refreshError) {
      toast.error(refreshError.message);
      return;
    }
    setTemplates(refreshed ?? []);
    startNew();
    toast.success("Mesaj şablonu kaydedildi.");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-[#1f2937]">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Mesaj Şablonları</h2>
            <p className="mt-0.5 text-xs text-slate-500">WhatsApp ve e-posta metinlerini merkezi olarak yönetin.</p>
          </div>
          <button type="button" onClick={startNew} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Yeni Şablon
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {templates.map(template => (
            <button key={template.id} type="button" onClick={() => startEdit(template)} className="rounded-xl border border-slate-200 p-4 text-left hover:border-blue-400 dark:border-[#1f2937] dark:hover:border-blue-500">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {template.channel === "whatsapp" ? <MessageCircle className="h-4 w-4 text-emerald-500" /> : <Mail className="h-4 w-4 text-blue-500" />}
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{template.name}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${template.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                  {template.is_active ? "Aktif" : "Pasif"}
                </span>
              </div>
              {template.subject_template && <p className="mt-2 truncate text-xs font-medium text-slate-600 dark:text-slate-300">{template.subject_template}</p>}
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">{template.body_template}</p>
              <span className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-blue-500"><Edit3 className="h-3 w-3" /> Düzenle</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]" data-testid="message-template-editor">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{editingId ? "Şablonu Düzenle" : "Yeni Şablon"}</h3>
            <p className="mt-1 text-xs text-slate-500">Değişkenler gönderim ekranında müşteri dosyasından doldurulur.</p>
          </div>
          {editingId && <button type="button" onClick={startNew} aria-label="Düzenlemeyi kapat"><X className="h-4 w-4 text-slate-500" /></button>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-500">Şablon Adı
            <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-500">Kanal
            <select value={form.channel} onChange={event => setForm(current => ({ ...current, channel: event.target.value, subject_template: event.target.value === "email" ? current.subject_template : null }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-posta</option>
            </select>
          </label>
        </div>

        {form.channel === "email" && (
          <label className="mt-4 block space-y-1.5 text-xs font-semibold text-slate-500">E-posta Konusu
            <input value={form.subject_template ?? ""} onChange={event => setForm(current => ({ ...current, subject_template: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
          </label>
        )}

        <label className="mt-4 block space-y-1.5 text-xs font-semibold text-slate-500">Mesaj
          <textarea rows={8} value={form.body_template} onChange={event => setForm(current => ({ ...current, body_template: event.target.value }))} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MESSAGE_TEMPLATE_VARIABLES.map(variable => (
            <button key={variable} type="button" onClick={() => setForm(current => ({ ...current, body_template: `${current.body_template}{{${variable}}}` }))} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600 dark:bg-[#1a2232] dark:text-slate-300">
              {`{{${variable}}}`}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} /> Aktif
          </label>
          <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
