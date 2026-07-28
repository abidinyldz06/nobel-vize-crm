"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, CheckCircle2, DatabaseBackup, Play, ShieldAlert, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Database } from "@/types/database";

type Candidate = Database["public"]["Functions"]["list_privacy_lifecycle_candidates_v1"]["Returns"][number];
type Action = Database["public"]["Tables"]["privacy_action_queue"]["Row"] & {
  customers: { first_name: string; last_name: string } | null;
};
type Approval = Database["public"]["Tables"]["privacy_action_approvals"]["Row"];
type Audit = Database["public"]["Tables"]["privacy_audit_log"]["Row"] & {
  staff: { full_name: string } | null;
};

const actionLabels: Record<string, string> = {
  anonymize: "Anonimleştir",
  purge: "Kalıcı sil",
};

const statusLabels: Record<string, string> = {
  pending: "Onay bekliyor",
  approved: "Yedek/çalıştırma bekliyor",
  processing: "İşleniyor",
  completed: "Tamamlandı",
  rejected: "Reddedildi",
  failed: "Başarısız",
};

const blockedLabels: Record<string, string> = {
  approved_request_required: "Onaylı KVKK talebi yok",
  retention_hold_active: "Hukuki saklama aktif",
  archive_grace_period: "Arşiv bekleme süresi dolmadı",
};

export default function PrivacyLifecycleDashboard({
  candidates,
  actions,
  approvals,
  audit,
  currentStaffId,
  loadError,
}: {
  candidates: Candidate[];
  actions: Action[];
  approvals: Approval[];
  audit: Audit[];
  currentStaffId: string;
  loadError: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(loadError);
  const approvalCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const approval of approvals) {
      counts.set(approval.action_id, (counts.get(approval.action_id) ?? 0) + 1);
    }
    return counts;
  }, [approvals]);

  async function run(key: string, operation: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await operation();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(null);
    }
  }

  function reason(promptText: string) {
    const value = window.prompt(promptText, "KVKK yaşam döngüsü prosedürü kapsamında");
    if (!value || value.trim().length < 5) {
      throw new Error("Gerekçe en az 5 karakter olmalı.");
    }
    return value.trim();
  }

  async function queue(candidate: Candidate) {
    const { error } = await supabase.rpc("queue_privacy_action_v1", {
      p_customer_id: candidate.customer_id,
      p_request_id: candidate.request_id,
      p_action_type: candidate.proposed_action,
      p_reason: reason("İşlemi kuyruğa alma gerekçesi"),
    });
    if (error) throw error;
  }

  async function approve(actionId: string) {
    const { error } = await supabase.rpc("approve_privacy_action_v1", {
      p_action_id: actionId,
      p_reason: reason("Onay gerekçesi"),
    });
    if (error) throw error;
  }

  async function reject(actionId: string) {
    const { error } = await supabase.rpc("reject_privacy_action_v1", {
      p_action_id: actionId,
      p_reason: reason("Ret gerekçesi"),
    });
    if (error) throw error;
  }

  async function execute(actionId: string) {
    const response = await fetch(`/api/privacy/actions/${actionId}/execute`, { method: "POST" });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "İşlem çalıştırılamadı.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-[#060d1a]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">KVKK Yaşam Döngüsü</h1>
          <p className="mt-1 text-sm text-slate-500">
            Varsayılan görünüm yalnızca dry-run adaylarını gösterir. Kalıcı silme iki ayrı yönetici onayı ve son onaydan sonra doğrulanmış yedek ister.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Summary icon={ShieldAlert} label="Dry-run adayı" value={candidates.length} />
          <Summary icon={DatabaseBackup} label="Onay/yedek bekleyen" value={actions.filter((item) => ["pending", "approved"].includes(item.status)).length} />
          <Summary icon={CheckCircle2} label="Tamamlanan" value={actions.filter((item) => item.status === "completed").length} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1420]">
          <h2 className="font-semibold text-slate-900 dark:text-white">Dry-run adayları</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="pb-3">Müşteri</th><th>Öneri</th><th>Dosya</th><th>Engeller</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {candidates.map((candidate) => {
                  const blocked = candidate.blocked_reasons?.length > 0;
                  const alreadyQueued = actions.some((item) =>
                    item.customer_id === candidate.customer_id && ["pending", "approved", "processing"].includes(item.status));
                  return (
                    <tr key={candidate.customer_id}>
                      <td className="py-3 font-medium text-slate-900 dark:text-white">{candidate.customer_name}</td>
                      <td>{actionLabels[candidate.proposed_action] ?? candidate.proposed_action}</td>
                      <td>{candidate.storage_file_count}</td>
                      <td className="max-w-sm text-xs text-slate-500">
                        {blocked ? candidate.blocked_reasons.map((item) => blockedLabels[item] ?? item).join(", ") : "Uygun"}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          disabled={blocked || alreadyQueued || busy !== null}
                          onClick={() => run(`queue-${candidate.customer_id}`, () => queue(candidate))}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {alreadyQueued ? "Kuyrukta" : "Kuyruğa al"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {candidates.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Uygun arşiv kaydı yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1420]">
          <h2 className="font-semibold text-slate-900 dark:text-white">Kontrollü işlem kuyruğu</h2>
          <div className="mt-4 space-y-3">
            {actions.map((action) => {
              const count = approvalCounts.get(action.id) ?? 0;
              const ownApproval = approvals.some((approval) => approval.action_id === action.id && approval.staff_id === currentStaffId);
              return (
                <div key={action.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {action.customers ? `${action.customers.first_name} ${action.customers.last_name}` : "Silinmiş kayıt"} · {actionLabels[action.action_type]}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {statusLabels[action.status]} · Onay {count}/{action.required_approvals} · {action.reason}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["pending", "approved"].includes(action.status) && !ownApproval && (
                      <button type="button" disabled={busy !== null} onClick={() => run(`approve-${action.id}`, () => approve(action.id))} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
                      </button>
                    )}
                    {action.status === "pending" && (
                      <button type="button" disabled={busy !== null} onClick={() => run(`reject-${action.id}`, () => reject(action.id))} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                        <XCircle className="h-3.5 w-3.5" /> Reddet
                      </button>
                    )}
                    {action.status === "approved" && (
                      <button type="button" disabled={busy !== null} onClick={() => run(`execute-${action.id}`, () => execute(action.id))} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-blue-600">
                        <Play className="h-3.5 w-3.5" /> Güvenli çalıştır
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {actions.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Kuyruk boş.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1420]">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><ArchiveRestore className="h-4 w-4" /> Değiştirilemez denetim izi</h2>
          <div className="mt-4 space-y-2">
            {audit.map((event) => (
              <div key={event.id} className="flex flex-col justify-between gap-1 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800 md:flex-row">
                <span className="text-slate-700 dark:text-slate-300">{event.event_type} · {event.reason ?? "Sistem kaydı"}</span>
                <span className="text-xs text-slate-500">{event.staff?.full_name ?? "Sistem"} · {new Date(event.created_at).toLocaleString("tr-TR")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof ShieldAlert; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1420]">
      <Icon className="h-5 w-5 text-blue-600" />
      <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
