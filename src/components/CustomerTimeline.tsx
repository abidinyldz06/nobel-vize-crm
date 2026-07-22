import { Banknote, CalendarDays, FileText, MessageCircle, NotebookPen, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tables } from "@/types/database";

type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string | null;
  icon: LucideIcon;
  color: string;
};

export default function CustomerTimeline({
  logs,
  notes,
  documents,
  payments,
  communications,
}: {
  logs: Tables<'activity_log'>[];
  notes: Tables<'notes'>[];
  documents: Tables<'documents'>[];
  payments: Tables<'payments'>[];
  communications: Tables<'communications'>[];
}) {
  const events: TimelineEvent[] = [
    ...logs.filter(log => log.type !== 'note').map(log => ({
      id: `log-${log.id}`,
      at: log.created_at,
      title: log.action,
      detail: log.performed_by,
      icon: log.type === 'appointment' ? CalendarDays : RefreshCw,
      color: log.type === 'appointment' ? 'bg-blue-500' : 'bg-slate-500',
    })),
    ...notes.map(note => ({
      id: `note-${note.id}`,
      at: note.created_at,
      title: 'Not eklendi',
      detail: note.content,
      icon: NotebookPen,
      color: 'bg-purple-500',
    })),
    ...documents.map(document => ({
      id: `document-${document.id}`,
      at: document.updated_at,
      title: `Evrak: ${document.document_type}`,
      detail: document.status === 'onaylandi' ? 'Tamamlandı' : document.status,
      icon: FileText,
      color: document.status === 'onaylandi' ? 'bg-emerald-500' : 'bg-amber-500',
    })),
    ...payments.map(payment => ({
      id: `payment-${payment.id}`,
      at: payment.created_at,
      title: `Ödeme: ₺${Number(payment.amount).toLocaleString('tr-TR')}`,
      detail: payment.status === 'alindi' ? 'Tahsil edildi' : payment.status,
      icon: Banknote,
      color: payment.status === 'alindi' ? 'bg-emerald-500' : 'bg-orange-500',
    })),
    ...communications.map(communication => ({
      id: `communication-${communication.id}`,
      at: communication.created_at,
      title: `İletişim: ${communication.type}`,
      detail: communication.subject || communication.content,
      icon: MessageCircle,
      color: 'bg-sky-500',
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]" data-testid="customer-timeline">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#1f2937] dark:bg-[#0a101a]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Müşteri Timeline</h3>
        <p className="mt-1 text-[10px] text-slate-500">Başvuru, evrak, ödeme, randevu, iletişim ve not hareketleri</p>
      </div>
      {events.length > 0 ? (
        <ol className="relative max-h-[520px] overflow-y-auto px-5 py-4 before:absolute before:bottom-5 before:left-[31px] before:top-5 before:w-px before:bg-slate-200 dark:before:bg-[#263244]">
          {events.map(event => (
            <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
              <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${event.color}`}><event.icon className="h-3 w-3" /></span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{event.title}</p>
                {event.detail && <p className="mt-1 line-clamp-3 text-[11px] text-slate-500">{event.detail}</p>}
                <time className="mt-1 block text-[9px] text-slate-400">{new Date(event.at).toLocaleString('tr-TR')}</time>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="px-5 py-6 text-center text-sm text-slate-500">Henüz timeline hareketi yok.</p>}
    </div>
  );
}
