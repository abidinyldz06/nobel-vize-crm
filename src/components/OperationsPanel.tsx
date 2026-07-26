"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

type OperationalEvent = Tables<"operational_events">;
type HealthState = "unknown" | "checking" | "ready" | "unavailable";

const severityLabels: Record<string, string> = {
  warning: "Uyarı",
  error: "Hata",
  critical: "Kritik",
};

const severityClasses: Record<string, string> = {
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  error: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export default function OperationsPanel({
  initialEvents,
}: {
  initialEvents: OperationalEvent[];
}) {
  const supabase = createSupabaseBrowserClient();
  const [events, setEvents] = useState(initialEvents);
  const [health, setHealth] = useState<HealthState>("unknown");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openEvents = useMemo(
    () => events.filter(event => event.status === "open"),
    [events],
  );

  const checkHealth = async () => {
    setHealth("checking");
    setError(null);
    try {
      const response = await fetch("/api/health/ready", { cache: "no-store" });
      setHealth(response.ok ? "ready" : "unavailable");
    } catch {
      setHealth("unavailable");
      setError("Sağlık kontrolüne ulaşılamadı.");
    }
  };

  const resolveEvent = async (eventId: string) => {
    setResolvingId(eventId);
    setError(null);
    const { data, error: resolveError } = await supabase.rpc(
      "resolve_operational_event_v1",
      { p_event_id: eventId },
    );
    if (resolveError || !data) {
      setError(resolveError?.message ?? "Olay kapatılamadı.");
    } else {
      const resolvedAt = new Date().toISOString();
      setEvents(current => current.map(event => (
        event.id === eventId
          ? { ...event, status: "resolved", resolved_at: resolvedAt }
          : event
      )));
    }
    setResolvingId(null);
  };

  return (
    <div className="space-y-5" data-testid="operations-panel">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1f2937] dark:bg-[#0d1420]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Uygulama</p>
            <Server className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
            {health === "ready" ? "Hazır" : health === "unavailable" ? "Erişim sorunu" : health === "checking" ? "Kontrol ediliyor" : "Kontrol bekliyor"}
          </p>
          <button
            type="button"
            onClick={checkHealth}
            disabled={health === "checking"}
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${health === "checking" ? "animate-spin" : ""}`} />
            Şimdi kontrol et
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1f2937] dark:bg-[#0d1420]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Açık olay</p>
            <CircleAlert className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{openEvents.length}</p>
          <p className="mt-1 text-xs text-slate-500">İnceleme veya çözüm bekliyor.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1f2937] dark:bg-[#0d1420]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kayıt güvenliği</p>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Güvenli alanlar</p>
          <p className="mt-1 text-xs text-slate-500">Hata mesajı ve müşteri verisi tutulmaz.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-[#1f2937] dark:bg-[#0a101a]">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Operasyon Olayları</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Son 50 olay; aynı hata tekrarları tek kayıtta birleştirilir.</p>
        </div>

        {events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Kayıtlı operasyon olayı yok.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
            {events.map(event => (
              <article key={event.id} className="px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${severityClasses[event.severity] ?? severityClasses.warning}`}>
                        {severityLabels[event.severity] ?? event.severity}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${event.status === "open" ? "bg-red-500/10 text-red-600 dark:text-red-300" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"}`}>
                        {event.status === "open" ? "Açık" : "Çözüldü"}
                      </span>
                      <span className="text-xs text-slate-500">{event.event_key}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{event.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Son: {formatDate(event.last_seen_at)}</span>
                      <span>Tekrar: {event.occurrence_count}</span>
                      {event.error_code && <span>Kod: {event.error_code}</span>}
                      {event.route && <span>Route: {event.route}</span>}
                      {event.request_id && <span>Request: {event.request_id}</span>}
                    </div>
                  </div>
                  {event.status === "open" && (
                    <button
                      type="button"
                      onClick={() => resolveEvent(event.id)}
                      disabled={resolvingId === event.id}
                      className="shrink-0 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
                    >
                      {resolvingId === event.id ? "Kapatılıyor..." : "Çözüldü olarak kapat"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
