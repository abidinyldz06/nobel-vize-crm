"use client";

import { useState } from "react";
import { ArchiveRestore, Eraser, FileX2, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { maskEmail, maskPhone } from "@/lib/masking";

export type ArchivedCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  assigned_staff_id: string | null;
  deleted_at: string;
  purge_eligible: boolean;
};

type PendingAction =
  | { type: "restore"; customer: ArchivedCustomer }
  | { type: "purge"; customer: ArchivedCustomer }
  | null;

type PrivacyCandidate = {
  customer_id: string;
  request_id: string | null;
  request_status: string | null;
  anonymized_at: string | null;
  storage_file_count: number;
  grace_eligible: boolean;
  retention_hold_active: boolean;
};

export default function CustomerArchiveTable({ customers, privacyCandidates }: { customers: ArchivedCustomer[]; privacyCandidates: PrivacyCandidate[] }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [processing, setProcessing] = useState(false);
  const [privacyProcessing, setPrivacyProcessing] = useState<string | null>(null);
  const privacyMap = new Map(privacyCandidates.map(candidate => [candidate.customer_id, candidate]));

  const eligibleCount = customers.filter(customer => customer.purge_eligible).length;

  const runAction = async () => {
    if (!pendingAction) return;
    setProcessing(true);

    const supabase = createSupabaseBrowserClient();
    const functionName = pendingAction.type === "restore"
      ? "restore_customers_v1"
      : "purge_deleted_customers_v1";
    const { data, error } = await supabase.rpc(functionName, {
      p_customer_ids: [pendingAction.customer.id],
    });

    setProcessing(false);
    if (error) {
      toast.error(error.message || "Arşiv işlemi tamamlanamadı.");
      return;
    }

    if (!data) {
      toast.error(
        pendingAction.type === "purge"
          ? "Müşteri anonimleştirme veya yapılandırılmış bekleme koşullarını henüz tamamlamamış."
          : "Müşteri bulunamadı veya zaten geri yüklenmiş.",
      );
      return;
    }

    toast.success(
      pendingAction.type === "restore"
        ? "Müşteri aktif listeye geri yüklendi."
        : "Müşteri kalıcı olarak silindi.",
    );
    setPendingAction(null);
    router.refresh();
  };

  const runPrivacyAction = async (customer: ArchivedCustomer, action: "documents" | "anonymize") => {
    const candidate = privacyMap.get(customer.id);
    if (!candidate?.request_id) return toast.error("Onaylanmış silme veya anonimleştirme talebi bulunmuyor.");
    if (!candidate.grace_eligible) return toast.error("Arşiv bekleme süresi henüz dolmadı.");
    if (candidate.retention_hold_active) return toast.error("Bu müşteri için aktif saklama kilidi var.");
    setPrivacyProcessing(`${customer.id}:${action}`);
    const response = await fetch(`/api/privacy/customers/${customer.id}/${action === "documents" ? "documents" : "anonymize"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "anonymize" ? JSON.stringify({ requestId: candidate.request_id }) : undefined,
    });
    const result = await response.json().catch(() => ({})) as { error?: string; deleted?: number };
    setPrivacyProcessing(null);
    if (!response.ok) return toast.error(result.error || "KVKK yaşam döngüsü işlemi tamamlanamadı.");
    toast.success(action === "documents" ? `${result.deleted ?? 0} evrak dosyası temizlendi.` : "Müşteri kontrollü olarak anonimleştirildi.");
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {customers.length} arşiv kaydı · {eligibleCount} kayıt kalıcı silme için uygun
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#1f2937] dark:bg-[#0a101a]">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Müşteri</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">İletişim</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Arşiv Tarihi</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {customers.map(customer => {
                const purgeEligible = customer.purge_eligible;
                const privacy = privacyMap.get(customer.id);
                return (
                  <tr key={customer.id} data-testid={`archived-customer-${customer.id}`}>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <p>{customer.phone ? maskPhone(customer.phone) : "—"}</p>
                      <p className="text-xs">{customer.email ? maskEmail(customer.email) : "—"}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(customer.deleted_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {privacy?.request_id && !privacy.anonymized_at && (
                          <>
                            {privacy.storage_file_count > 0 && <button data-testid={`cleanup-documents-${customer.id}`} onClick={() => runPrivacyAction(customer, "documents")} disabled={!privacy.grace_eligible || privacy.retention_hold_active || privacyProcessing !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 disabled:opacity-35"><FileX2 className="h-3.5 w-3.5" />Evrakları Temizle</button>}
                            <button data-testid={`anonymize-customer-${customer.id}`} onClick={() => runPrivacyAction(customer, "anonymize")} disabled={!privacy.grace_eligible || privacy.retention_hold_active || privacy.storage_file_count > 0 || privacyProcessing !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-600 disabled:opacity-35"><Eraser className="h-3.5 w-3.5" />Anonimleştir</button>
                          </>
                        )}
                        <button
                          data-testid={`restore-customer-${customer.id}`}
                          onClick={() => setPendingAction({ type: "restore", customer })}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Geri Yükle
                        </button>
                        <button
                          data-testid={`purge-customer-${customer.id}`}
                          onClick={() => setPendingAction({ type: "purge", customer })}
                          disabled={!purgeEligible}
                          title={purgeEligible ? "Kalıcı sil" : "Önce onaylı talep, bekleme süresi ve anonimleştirme tamamlanmalıdır"}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Kalıcı Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center text-sm text-slate-500">
                    Arşivde müşteri bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 md:hidden dark:divide-[#1f2937]">
          {customers.map(customer => (
            <div key={customer.id} className="space-y-3 p-4" data-testid={`archived-customer-mobile-${customer.id}`}>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-200">{customer.first_name} {customer.last_name}</p>
                <p className="text-xs text-slate-500">{new Date(customer.deleted_at).toLocaleString("tr-TR")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {privacyMap.get(customer.id)?.request_id && !privacyMap.get(customer.id)?.anonymized_at && Boolean(privacyMap.get(customer.id)?.storage_file_count) && <button onClick={() => runPrivacyAction(customer, "documents")} disabled={!privacyMap.get(customer.id)?.grace_eligible || Boolean(privacyMap.get(customer.id)?.retention_hold_active) || privacyProcessing !== null} className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 disabled:opacity-35"><FileX2 className="h-4 w-4" />Evrakları Temizle</button>}
                {privacyMap.get(customer.id)?.request_id && !privacyMap.get(customer.id)?.anonymized_at && <button onClick={() => runPrivacyAction(customer, "anonymize")} disabled={!privacyMap.get(customer.id)?.grace_eligible || Boolean(privacyMap.get(customer.id)?.retention_hold_active) || Boolean(privacyMap.get(customer.id)?.storage_file_count) || privacyProcessing !== null} className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-600 disabled:opacity-35"><Eraser className="h-4 w-4" />Kontrollü Anonimleştir</button>}
                <button
                  data-testid={`restore-customer-mobile-${customer.id}`}
                  onClick={() => setPendingAction({ type: "restore", customer })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500"
                >
                  <ArchiveRestore className="h-4 w-4" /> Geri Yükle
                </button>
                <button
                  data-testid={`purge-customer-mobile-${customer.id}`}
                  onClick={() => setPendingAction({ type: "purge", customer })}
                  disabled={!customer.purge_eligible}
                  title={customer.purge_eligible ? "Kalıcı sil" : "Önce onaylı talep, bekleme süresi ve anonimleştirme tamamlanmalıdır"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Trash2 className="h-4 w-4" /> Kalıcı Sil
                </button>
              </div>
            </div>
          ))}
          {customers.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Arşivde müşteri bulunmuyor.</p>}
        </div>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1f2937] dark:bg-[#0d1420]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {pendingAction.type === "restore" ? "Müşteriyi Geri Yükle" : "Müşteriyi Kalıcı Sil"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pendingAction.customer.first_name} {pendingAction.customer.last_name}
                </p>
              </div>
              <button onClick={() => setPendingAction(null)} disabled={processing} className="text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              {pendingAction.type === "restore"
                ? "Müşteri yeniden aktif listelere alınacak."
                : "Bu işlem müşteriyi ve ilişkili kayıtlarını geri alınamaz biçimde silecektir."}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingAction(null)} disabled={processing} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500">
                İptal
              </button>
              <button
                data-testid="confirm-archive-action"
                onClick={runAction}
                disabled={processing}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white ${pendingAction.type === "restore" ? "bg-emerald-600" : "bg-red-600"}`}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                {pendingAction.type === "restore" ? "Geri Yükle" : "Kalıcı Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
