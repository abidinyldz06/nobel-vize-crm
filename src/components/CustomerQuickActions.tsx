"use client";

import { useState } from "react";
import { Mail, MessageCircle, NotebookPen, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function whatsappNumber(phone: string) {
  let number = phone.replace(/\D/g, '');
  if (number.startsWith('0')) number = `90${number.slice(1)}`;
  if (!number.startsWith('90') && number.length === 10) number = `90${number}`;
  return number;
}

export default function CustomerQuickActions({
  customerId,
  firstName,
  phone,
  email,
}: {
  customerId: string;
  firstName: string;
  phone: string | null;
  email: string | null;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('add_customer_quick_note_v1', {
      p_customer_id: customerId,
      p_content: note.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNote('');
    setNoteOpen(false);
    toast.success('Hızlı not eklendi.');
  };

  const actionClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-500 dark:border-[#1f2937]";

  return (
    <>
      <div className="flex items-center gap-1" data-testid={`quick-actions-${customerId}`}>
        {phone && <a href={`tel:${phone}`} aria-label={`${firstName} telefon ara`} className={actionClass}><Phone className="h-3.5 w-3.5" /></a>}
        {phone && <a href={`https://wa.me/${whatsappNumber(phone)}`} target="_blank" rel="noreferrer" aria-label={`${firstName} WhatsApp`} className={actionClass}><MessageCircle className="h-3.5 w-3.5" /></a>}
        {email && <a href={`mailto:${email}`} aria-label={`${firstName} e-posta`} className={actionClass}><Mail className="h-3.5 w-3.5" /></a>}
        <button type="button" onClick={() => setNoteOpen(true)} aria-label={`${firstName} hızlı not ekle`} className={actionClass}><NotebookPen className="h-3.5 w-3.5" /></button>
      </div>

      {noteOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1f2937] dark:bg-[#0d1420]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">Hızlı Not Ekle</h2>
              <button type="button" onClick={() => setNoteOpen(false)} aria-label="Hızlı not penceresini kapat"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <textarea aria-label="Hızlı not" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Müşteriyle ilgili kısa not…" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNoteOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500">İptal</button>
              <button type="button" onClick={() => void saveNote()} disabled={saving || !note.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Kaydediliyor…' : 'Notu Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
