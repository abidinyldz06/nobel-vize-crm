"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardList, Download, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

type Notice = Tables<"privacy_notice_versions">;
type Delivery = Tables<"customer_privacy_notices">;
type Consent = Tables<"customer_consents">;
type DataRequest = Tables<"data_subject_requests">;

const consentLabels: Record<string, string> = {
  marketing: "Pazarlama iletişimi",
  cross_border_transfer: "Yurt dışına veri aktarımı",
  special_category_processing: "Özel nitelikli veri işleme",
};
const decisionLabels: Record<string, string> = { granted: "Rıza verdi", refused: "Reddetti", withdrawn: "Rızayı geri çekti" };
const methodLabels: Record<string, string> = { yuz_yuze: "Yüz yüze", email: "E-posta", whatsapp: "WhatsApp", portal: "Portal", telefon: "Telefon", diger: "Diğer" };

export default function CustomerPrivacyPanel({ customerId, notices, deliveries, consents, requests, isAdmin }: { customerId: string; notices: Notice[]; deliveries: Delivery[]; consents: Consent[]; requests: DataRequest[]; isAdmin: boolean }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const activeNotices = notices.filter(notice => notice.is_active && new Date(notice.effective_at) <= new Date());
  const [noticeId, setNoticeId] = useState(activeNotices[0]?.id ?? "");
  const [deliveryMethod, setDeliveryMethod] = useState("yuz_yuze");
  const [acknowledged, setAcknowledged] = useState(true);
  const [consentType, setConsentType] = useState("marketing");
  const [decision, setDecision] = useState("granted");
  const [source, setSource] = useState("yuz_yuze");
  const [evidence, setEvidence] = useState("");
  const [requestType, setRequestType] = useState("access");
  const [requestVia, setRequestVia] = useState("email");
  const [requestNotes, setRequestNotes] = useState("");
  const [saving, setSaving] = useState<"notice" | "consent" | "request" | "status" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestConsents = useMemo(() => {
    const latest = new Map<string, Consent>();
    for (const consent of consents) if (!latest.has(consent.consent_type)) latest.set(consent.consent_type, consent);
    return latest;
  }, [consents]);

  const run = async (kind: "notice" | "consent") => {
    setSaving(kind);
    setError(null);
    setMessage(null);
    try {
      if (kind === "notice") {
        if (!noticeId) throw new Error("Önce Ayarlar bölümünden aktif bir aydınlatma metni oluşturun.");
        const now = new Date().toISOString();
        const { error: rpcError } = await supabase.rpc("record_customer_privacy_notice_v1", { p_payload: { customer_id: customerId, notice_version_id: noticeId, delivery_method: deliveryMethod, delivered_at: now, acknowledged_at: acknowledged ? now : null, evidence_note: evidence.trim() || null } });
        if (rpcError) throw rpcError;
        setMessage("Aydınlatma teslim kaydı oluşturuldu.");
      } else {
        const { error: rpcError } = await supabase.rpc("record_customer_consent_v1", { p_payload: { customer_id: customerId, consent_type: consentType, decision, source, notice_version_id: noticeId || null, evidence_note: evidence.trim() || null } });
        if (rpcError) throw rpcError;
        setMessage("Rıza kararı geçmişe eklendi.");
      }
      setEvidence("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : typeof caught === "object" && caught && "message" in caught ? String(caught.message) : "İşlem başarısız oldu.");
    } finally {
      setSaving(null);
    }
  };

  const createRequest = async () => {
    setSaving("request"); setError(null); setMessage(null);
    const { error: rpcError } = await supabase.rpc("create_data_subject_request_v1", { p_payload: { customer_id: customerId, request_type: requestType, requested_via: requestVia, notes: requestNotes.trim() || null } });
    if (rpcError) setError(rpcError.message); else { setMessage("Veri sahibi talebi kaydedildi."); setRequestNotes(""); router.refresh(); }
    setSaving(null);
  };

  const setRequestStatus = async (requestId: string, status: string) => {
    setSaving("status"); setError(null); setMessage(null);
    const { error: rpcError } = await supabase.rpc("set_data_subject_request_status_v1", { p_request_id: requestId, p_status: status });
    if (rpcError) setError(rpcError.message); else { setMessage("Talep durumu güncellendi."); router.refresh(); }
    setSaving(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]" data-testid="customer-privacy-panel">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#1f2937] dark:bg-[#0a101a]">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><ShieldCheck className="h-4 w-4 text-blue-500" />KVKK Kayıtları</h3>
        <p className="mt-1 text-[11px] text-slate-500">Aydınlatma teslimi ile açık rıza kararları ayrı geçmiş olarak tutulur.</p>
      </div>
      <div className="space-y-4 p-5">
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}
        {message && <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500"><Check className="h-4 w-4" />{message}</p>}
        <label className="block space-y-1 text-xs font-semibold text-slate-500">Aydınlatma sürümü<select aria-label="Aydınlatma Sürümü" value={noticeId} onChange={event => setNoticeId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200"><option value="">Seçiniz</option>{activeNotices.map(notice => <option key={notice.id} value={notice.id}>{notice.version} · {notice.title}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-semibold text-slate-500">Teslim yöntemi<select aria-label="Teslim Yöntemi" value={deliveryMethod} onChange={event => setDeliveryMethod(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">{["yuz_yuze", "email", "whatsapp", "portal", "diger"].map(value => <option key={value} value={value}>{methodLabels[value]}</option>)}</select></label>
          <label className="flex items-end gap-2 pb-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />Müşteri teyit etti</label>
        </div>
        <button type="button" onClick={() => run("notice")} disabled={saving !== null} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-500 disabled:opacity-60">{saving === "notice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}Aydınlatma teslimini kaydet</button>

        <div className="border-t border-slate-200 pt-4 dark:border-[#1f2937]">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold text-slate-500">Rıza konusu<select aria-label="Rıza Konusu" value={consentType} onChange={event => setConsentType(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">{Object.entries(consentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1 text-xs font-semibold text-slate-500">Karar<select aria-label="Rıza Kararı" value={decision} onChange={event => setDecision(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">{Object.entries(decisionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1 text-xs font-semibold text-slate-500">Kaynak<select aria-label="Rıza Kaynağı" value={source} onChange={event => setSource(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">{["yuz_yuze", "email", "whatsapp", "portal", "telefon", "diger"].map(value => <option key={value} value={value}>{methodLabels[value]}</option>)}</select></label>
          </div>
          <textarea aria-label="KVKK Kanıt Notu" value={evidence} onChange={event => setEvidence(event.target.value)} maxLength={2000} rows={2} placeholder="Belge, görüşme veya teyit notu (isteğe bağlı)" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
          <button type="button" onClick={() => run("consent")} disabled={saving !== null} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving === "consent" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Rıza kararını kaydet</button>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-[#1f2937]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Güncel rıza durumu</p>
          <div className="space-y-2">{Object.entries(consentLabels).map(([type, label]) => { const current = latestConsents.get(type); return <div key={type} className="flex items-center justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">{label}</span><span className={current?.decision === "granted" ? "text-emerald-500" : "text-amber-500"}>{current ? decisionLabels[current.decision] : "Kayıt yok"}</span></div>; })}</div>
          <p className="mt-3 text-[10px] text-slate-500">Aydınlatma kayıtları: {deliveries.length} · Rıza kararları: {consents.length}</p>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-[#1f2937]">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><ClipboardList className="h-3.5 w-3.5" />Veri sahibi talepleri</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold text-slate-500">Talep türü<select aria-label="KVKK Talep Türü" value={requestType} onChange={event => setRequestType(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200"><option value="access">Erişim</option><option value="export">Dışa aktarma</option><option value="correction">Düzeltme</option><option value="restriction">İşlemeyi kısıtlama</option><option value="deletion">Silme</option><option value="anonymization">Anonimleştirme</option></select></label>
            <label className="space-y-1 text-xs font-semibold text-slate-500">Talep kanalı<select aria-label="KVKK Talep Kanalı" value={requestVia} onChange={event => setRequestVia(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200">{["yuz_yuze", "email", "whatsapp", "portal", "telefon", "diger"].map(value => <option key={value} value={value}>{methodLabels[value]}</option>)}</select></label>
          </div>
          <textarea aria-label="KVKK Talep Notu" value={requestNotes} onChange={event => setRequestNotes(event.target.value)} maxLength={4000} rows={2} placeholder="Talebin kapsamı ve kimlik doğrulama notu" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-[#1f2937] dark:bg-[#060d1a] dark:text-slate-200" />
          <button type="button" onClick={createRequest} disabled={saving !== null} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-[#334155] dark:text-slate-200">{saving === "request" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}Talebi kaydet</button>
          {isAdmin && <a href={`/api/privacy/customers/${customerId}/export`} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Download className="h-4 w-4" />Müşteri veri paketini indir</a>}
          <div className="mt-3 space-y-2">{requests.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-[#060d1a]"><div className="flex items-center justify-between"><span className="font-semibold text-slate-700 dark:text-slate-200">{item.request_type}</span><span className="text-slate-500">{item.status}</span></div><p className="mt-1 text-[10px] text-slate-500">{new Date(item.requested_at).toLocaleString("tr-TR")}</p>{isAdmin && !["completed", "rejected", "cancelled"].includes(item.status) && <div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => setRequestStatus(item.id, "in_review")} className="rounded bg-blue-500/10 px-2 py-1 text-blue-500">İncele</button><button type="button" onClick={() => setRequestStatus(item.id, "approved")} className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-500">Onayla</button><button type="button" onClick={() => setRequestStatus(item.id, "rejected")} className="rounded bg-red-500/10 px-2 py-1 text-red-500">Reddet</button></div>}</div>)}</div>
        </div>
      </div>
    </div>
  );
}
