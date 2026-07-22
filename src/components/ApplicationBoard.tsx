"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Columns3, Filter, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_META,
  APPLICATION_TRANSITIONS,
  type ApplicationStatus,
  isApplicationStatus,
} from "@/lib/application-status";

type BoardApplication = {
  id: string;
  customer_id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  appointment_date: string | null;
  assigned_staff_id: string | null;
  customers: { id: string; first_name: string; last_name: string; is_deleted: boolean };
  assigned_staff: { id: string; full_name: string } | null;
};

const DELAY_DAYS: Partial<Record<ApplicationStatus, number>> = {
  profil_analizi: 3,
  evrak_bekleniyor: 3,
  randevu_bekleniyor: 2,
  randevu_alindi: 3,
  evrak_hazirlaniyor: 3,
  basvuru_yapildi: 7,
  itiraz: 7,
};

function isDelayed(application: BoardApplication) {
  if (!isApplicationStatus(application.status)) return false;
  const threshold = DELAY_DAYS[application.status];
  if (!threshold) return false;
  return Date.now() - new Date(application.updated_at).getTime() >= threshold * 86_400_000;
}

export default function ApplicationBoard({
  initialApplications,
  loadError,
}: {
  initialApplications: BoardApplication[];
  loadError: string | null;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [staffFilter, setStaffFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<BoardApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const staffOptions = useMemo(() => {
    const options = new Map<string, string>();
    applications.forEach(application => {
      if (application.assigned_staff) options.set(application.assigned_staff.id, application.assigned_staff.full_name);
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [applications]);

  const countryOptions = useMemo(
    () => [...new Set(applications.map(application => application.country))].sort((a, b) => a.localeCompare(b, "tr")),
    [applications],
  );

  const filtered = useMemo(() => applications.filter(application => {
    if (staffFilter === "unassigned" && application.assigned_staff_id) return false;
    if (staffFilter !== "all" && staffFilter !== "unassigned" && application.assigned_staff_id !== staffFilter) return false;
    if (countryFilter !== "all" && application.country !== countryFilter) return false;
    const created = new Date(application.created_at);
    if (dateFrom && created < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo) {
      const end = new Date(`${dateTo}T00:00:00`);
      end.setDate(end.getDate() + 1);
      if (created >= end) return false;
    }
    if (delayedOnly && !isDelayed(application)) return false;
    return true;
  }), [applications, countryFilter, dateFrom, dateTo, delayedOnly, staffFilter]);

  const updateStatus = async (application: BoardApplication, status: ApplicationStatus, reason?: string) => {
    if (status === "reddedildi" && !reason) {
      setRejectionTarget(application);
      return;
    }

    setProcessingId(application.id);
    try {
      const response = await fetch("/api/applications/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id, status, rejectionReason: reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Başvuru durumu güncellenemedi.");
      setApplications(current => current.map(item => item.id === application.id
        ? { ...item, status, updated_at: new Date().toISOString() }
        : item));
      setRejectionTarget(null);
      setRejectionReason("");
      toast.success(`Başvuru “${APPLICATION_STATUS_META[status].label}” aşamasına taşındı.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Başvuru durumu güncellenemedi.");
    } finally {
      setProcessingId(null);
    }
  };

  const grouped = useMemo(() => {
    const result = Object.fromEntries(APPLICATION_STATUSES.map(status => [status, [] as BoardApplication[]])) as Record<ApplicationStatus, BoardApplication[]>;
    filtered.forEach(application => {
      if (isApplicationStatus(application.status)) result[application.status].push(application);
    });
    return result;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-[#060d1a]">
      <div className="mb-7">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
          <Columns3 className="h-5 w-5 text-blue-500" /> Başvuru Süreç Panosu
        </h1>
        <p className="mt-1 text-xs text-slate-500">Başvuruları aşama, personel, ülke, tarih ve gecikme durumuna göre yönetin.</p>
      </div>

      {loadError && <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">{loadError}</div>}

      <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5 dark:border-[#1f2937] dark:bg-[#0d1420]">
        <label className="text-xs font-semibold text-slate-500">Personel
          <select value={staffFilter} onChange={event => setStaffFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-slate-200">
            <option value="all">Tüm Personel</option>
            <option value="unassigned">Atanmamış</option>
            {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">Ülke
          <select value={countryFilter} onChange={event => setCountryFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-slate-200">
            <option value="all">Tüm Ülkeler</option>
            {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">Başlangıç
          <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-slate-200" />
        </label>
        <label className="text-xs font-semibold text-slate-500">Bitiş
          <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-slate-200" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-slate-300">
          <input type="checkbox" checked={delayedOnly} onChange={event => setDelayedOnly(event.target.checked)} className="h-4 w-4 rounded" />
          <Filter className="h-4 w-4 text-red-500" /> Yalnız gecikenler
        </label>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length} başvuru</span>
        <span>Gecikme, aşamaya göre 2–7 günlük hareketsizlik üzerinden hesaplanır.</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-5">
        {APPLICATION_STATUSES.map(status => (
          <section key={status} className="w-[310px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-[#1f2937] dark:bg-[#090f1a]">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#1f2937]">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{APPLICATION_STATUS_META[status].column}</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-[#1f2937] dark:text-slate-300">{grouped[status].length}</span>
            </header>
            <div className="max-h-[66vh] space-y-3 overflow-y-auto p-3">
              {grouped[status].length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400 dark:border-[#263244]">Bu aşamada başvuru yok.</div>
              ) : grouped[status].map(application => {
                const delayed = isDelayed(application);
                const transitions = APPLICATION_TRANSITIONS[status];
                return (
                  <article key={application.id} data-testid={`application-card-${application.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1f2937] dark:bg-[#0d1420]">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link href={`/customers/${application.customer_id}`} className="font-semibold text-slate-900 hover:text-blue-500 dark:text-white">
                        {application.customers.first_name} {application.customers.last_name}
                      </Link>
                      {delayed && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-label="Geciken başvuru" />}
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-500">
                      <p>{application.country} · {application.visa_type}</p>
                      <p>{application.assigned_staff?.full_name || "Atanmamış"}</p>
                      <p className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {new Date(application.updated_at).toLocaleDateString("tr-TR")}</p>
                    </div>
                    {transitions.length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-[#1f2937]">
                        <select
                          aria-label={`${application.customers.first_name} ${application.customers.last_name} sonraki aşama`}
                          defaultValue=""
                          disabled={processingId === application.id}
                          onChange={event => {
                            const next = event.target.value;
                            event.target.value = "";
                            if (isApplicationStatus(next)) void updateStatus(application, next);
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-[#263244] dark:bg-[#060c18] dark:text-slate-300"
                        >
                          <option value="">Aşamayı değiştir…</option>
                          {transitions.map(next => <option key={next} value={next}>{APPLICATION_STATUS_META[next].label}</option>)}
                        </select>
                        {processingId === application.id && <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin text-blue-500" />}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {rejectionTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1f2937] dark:bg-[#0d1420]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">Ret Sebebi</h2>
              <button type="button" onClick={() => setRejectionTarget(null)} aria-label="Ret penceresini kapat"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <p className="mb-3 text-xs text-slate-500">{rejectionTarget.customers.first_name} {rejectionTarget.customers.last_name} başvurusu için açıklama zorunludur.</p>
            <textarea value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} maxLength={2000} rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white" placeholder="Konsolosluk ret sebebi…" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectionTarget(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500">İptal</button>
              <button type="button" disabled={!rejectionReason.trim() || processingId === rejectionTarget.id} onClick={() => void updateStatus(rejectionTarget, "reddedildi", rejectionReason.trim())} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reddedildi Olarak Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
