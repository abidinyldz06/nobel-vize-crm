"use client"
import { Activity, User, Clock, CheckCircle2, AlertCircle, FileText, CreditCard, Calendar } from "lucide-react";

type LogEntry = {
  id: string;
  action: string;
  performed_by: string | null;
  created_at: string;
};

function getIcon(action: string) {
  if (action.includes("Durum"))   return <Activity className="w-3.5 h-3.5 text-blue-400" />;
  if (action.includes("Ödeme"))   return <CreditCard className="w-3.5 h-3.5 text-emerald-400" />;
  if (action.includes("Randevu")) return <Calendar className="w-3.5 h-3.5 text-purple-400" />;
  if (action.includes("Evrak"))   return <FileText className="w-3.5 h-3.5 text-amber-400" />;
  if (action.includes("Onay"))    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (action.includes("Red"))     return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Activity className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "Az önce";
  if (mins < 60)  return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

export default function ActivityLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" /> Aktivite Geçmişi
        </h3>
      </div>

      <div className="relative max-h-72 overflow-y-auto">
        {/* Vertical line */}
        <div className="absolute left-[30px] top-0 bottom-0 w-px bg-slate-200 dark:bg-[#1f2937]" />

        <div className="py-3 space-y-0">
          {logs.length > 0 ? logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors">
              {/* Icon bubble */}
              <div className="relative z-10 w-7 h-7 rounded-full bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(log.action)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{log.action}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <User className="w-2.5 h-2.5" /> {log.performed_by || "Sistem"}
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {timeAgo(log.created_at)}
                  </span>
                </div>
              </div>
              <span className="text-[9px] text-slate-600 shrink-0 mt-0.5">
                {new Date(log.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
          )) : (
            <div className="px-5 py-8 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              <p className="text-slate-600 text-xs">Henüz aktivite yok.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
