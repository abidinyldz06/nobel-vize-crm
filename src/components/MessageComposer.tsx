"use client";

import { useMemo, useState } from "react";
import { Mail, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { APPLICATION_STATUS_META, isApplicationStatus } from "@/lib/application-status";
import { renderMessageTemplate, type MessageTemplateContext } from "@/lib/message-templates";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

type MessageTemplate = Tables<"message_templates">;

interface MessageComposerProps {
  customer: Pick<Tables<"customers">, "id" | "first_name" | "last_name" | "phone" | "email" | "portal_token" | "portal_token_expires_at" | "portal_access_enabled">;
  application: Pick<Tables<"applications">, "id" | "country" | "status" | "appointment_date" | "appointment_location" | "total_fee">;
  documents: Pick<Tables<"documents">, "document_type" | "status">[];
  payments: Pick<Tables<"payments">, "status" | "amount">[];
  templates: MessageTemplate[];
  company: Pick<Tables<"tenants">, "company_name">;
}

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `9${digits}`;
  return `90${digits}`;
}

export default function MessageComposer({ customer, application, documents, payments, templates, company }: MessageComposerProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const activeTemplates = templates.filter(template => template.is_active);
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(activeTemplates[0]?.id ?? "");
  const [sending, setSending] = useState(false);

  const selected = activeTemplates.find(template => template.id === templateId) ?? activeTemplates[0];
  const totalPaid = payments.filter(payment => payment.status === "alindi").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const portalValid = customer.portal_access_enabled
    && customer.portal_token
    && customer.portal_token_expires_at
    && new Date(customer.portal_token_expires_at) > new Date();
  const portalUrl = portalValid && typeof window !== "undefined" ? `${window.location.origin}/portal/${customer.portal_token}` : "";
  const context: MessageTemplateContext = {
    first_name: customer.first_name,
    last_name: customer.last_name,
    country: application.country ?? "",
    status: isApplicationStatus(application.status) ? APPLICATION_STATUS_META[application.status].label : application.status,
    document_list: documents.map((document, index) => `${index + 1}. ${document.document_type ?? "Evrak"} — ${document.status === "onaylandi" ? "Tamamlandı" : "Bekleniyor"}`).join("\n") || "Evrak listeniz hazırlanıyor.",
    appointment_date: application.appointment_date ? new Date(application.appointment_date).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) : "Henüz belirlenmedi",
    appointment_location: application.appointment_location || "Henüz belirlenmedi",
    remaining_fee: `₺${Math.max(0, Number(application.total_fee ?? 0) - totalPaid).toLocaleString("tr-TR")}`,
    portal_url: portalUrl || "Portal bağlantınız henüz aktif değil.",
    company_name: company.company_name,
  };
  const subject = selected ? renderMessageTemplate(selected.subject_template ?? "", context) : "";
  const body = selected ? renderMessageTemplate(selected.body_template, context) : "";
  const recipient = selected?.channel === "whatsapp" ? customer.phone : customer.email;

  const prepare = async () => {
    if (!selected) return;
    if (!recipient) {
      await supabase.rpc("record_communication_v1", {
        p_payload: {
          customer_id: customer.id,
          application_id: application.id,
          template_id: selected.id,
          type: selected.channel,
          direction: "giden",
          subject: subject || null,
          content: body,
          status: "basarisiz",
          failure_reason: selected.channel === "whatsapp" ? "Müşteri telefon numarası bulunamadı" : "Müşteri e-posta adresi bulunamadı",
        },
      });
      toast.error(selected.channel === "whatsapp" ? "Müşterinin telefon numarası yok." : "Müşterinin e-posta adresi yok.");
      return;
    }

    setSending(true);
    const popup = selected.channel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    const { error } = await supabase.rpc("record_communication_v1", {
      p_payload: {
        customer_id: customer.id,
        application_id: application.id,
        template_id: selected.id,
        type: selected.channel,
        direction: "giden",
        subject: subject || null,
        content: body,
        status: "hazirlandi",
        recipient,
      },
    });
    setSending(false);

    if (error) {
      popup?.close();
      toast.error(error.message);
      return;
    }

    if (selected.channel === "whatsapp") {
      const target = `https://wa.me/${whatsappNumber(recipient)}?text=${encodeURIComponent(body)}`;
      if (popup) popup.location.href = target;
      else window.open(target, "_blank", "noopener,noreferrer");
    } else {
      window.open(`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
    }
    toast.success("Mesaj hazırlandı ve iletişim geçmişine kaydedildi.");
    setOpen(false);
  };

  if (activeTemplates.length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700">
        <MessageCircle className="h-3.5 w-3.5" /> Mesaj Hazırla
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#1f2937] dark:bg-[#0d1420]" data-testid="message-composer">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-[#1f2937]">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Mesaj Hazırla</h3>
                <p className="text-xs text-slate-500">Mesaj harici uygulamada açılır; teslim durumu sonradan işaretlenir.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Mesaj penceresini kapat"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block space-y-1.5 text-xs font-semibold text-slate-500">Şablon
                <select value={selected?.id ?? ""} onChange={event => setTemplateId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">
                  {activeTemplates.map(template => <option key={template.id} value={template.id}>{template.channel === "whatsapp" ? "WhatsApp" : "E-posta"} — {template.name}</option>)}
                </select>
              </label>
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-[#060d1a]">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  {selected?.channel === "whatsapp" ? <MessageCircle className="h-4 w-4 text-emerald-500" /> : <Mail className="h-4 w-4 text-blue-500" />}
                  {recipient || "Alıcı bilgisi eksik"}
                </div>
                {subject && <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{subject}</p>}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{body}</p>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={prepare} disabled={sending} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  <Send className="h-4 w-4" /> {sending ? "Kaydediliyor..." : "Kaydet ve Uygulamada Aç"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
