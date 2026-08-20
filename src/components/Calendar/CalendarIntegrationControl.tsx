"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";

type CalendarStatus = {
  connected: boolean;
  syncEnabled: boolean;
  calendarId: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export default function CalendarIntegrationControl() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = async () => {
    const response = await fetch("/api/integrations/google-calendar", { cache: "no-store" });
    if (!response.ok) return;
    setStatus(await response.json() as CalendarStatus);
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/integrations/google-calendar", { cache: "no-store" })
      .then(async response => {
        if (!response.ok || !active) return;
        const nextStatus = await response.json() as CalendarStatus;
        if (active) setStatus(nextStatus);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const sync = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/google-calendar", { method: "POST" });
      if (!response.ok) throw new Error("sync_failed");
      setMessage("Randevular Google Takvim ile eşitlendi.");
      await loadStatus();
    } catch {
      setMessage("Eşitleme şu an tamamlanamadı. Bağlantıyı ve yetkiyi kontrol edin.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Google Takvim bağlantısı, CRM'de saklanan anahtarlar ve Google erişim yetkisi kaldırılacak. Devam edilsin mi?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/google-calendar", { method: "DELETE" });
      if (!response.ok) throw new Error("disconnect_failed");
      setStatus({ connected: false, syncEnabled: false, calendarId: null, lastSyncedAt: null, lastSyncError: null });
      setMessage("Google Takvim bağlantısı ve saklanan erişim anahtarları kaldırıldı.");
    } catch {
      setMessage("Bağlantı kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {status.connected ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={sync}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-300"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Google Takvim’i eşitle
          </button>
          <button
            type="button"
            aria-label="Google Takvim bağlantısını kaldır"
            title="Bağlantıyı kaldır"
            onClick={disconnect}
            disabled={busy}
            className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-300"
          >
            <Unplug className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="max-w-md rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-right">
          <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            Bağlantı isteğe bağlıdır. CRM yalnız sahibi olduğunuz birincil Google Takvimindeki CRM bağlantılı randevuları oluşturur, okur, günceller ve kaldırır. Veriler reklam veya yapay zekâ modeli eğitimi için kullanılmaz. Ayrıntılar için <Link href="/privacy-policy" className="font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300">Gizlilik Politikası</Link>.
          </p>
          <a
            href="/api/integrations/google-calendar/connect"
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-300"
          >
            <Link2 className="h-3.5 w-3.5" /> Açıklamayı okudum, Google Takvim’i bağla
          </a>
        </div>
      )}
      {status.connected && !message && (
        <p className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {status.lastSyncedAt ? `Son eşitleme: ${new Date(status.lastSyncedAt).toLocaleString("tr-TR")}` : "Eşitleme bekliyor"}
        </p>
      )}
      {message && <p role="status" className="max-w-56 text-right text-[10px] text-slate-500">{message}</p>}
    </div>
  );
}
