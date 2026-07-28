"use client";

import { useState } from "react";
import { ArrowRight, Plus, RefreshCw, Search, UserRoundSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

type Lead = Tables<"leads">;
type StaffOption = Pick<Tables<"staff">, "id" | "full_name">;
type CountryOption = Pick<Tables<"countries">, "id" | "name">;
type Duplicate = {
  entity_type: string;
  entity_id: string;
  match_reason: string;
  display_name: string;
};

const statusLabels: Record<string, string> = {
  new: "Yeni",
  contacted: "İletişime geçildi",
  qualified: "Nitelikli",
  unqualified: "Uygun değil",
  converted: "Dönüştürüldü",
  lost: "Kaybedildi",
};

export default function LeadManagementClient({
  initialLeads,
  staffList,
  countries,
  isAdmin,
  currentStaffId,
}: {
  initialLeads: Lead[];
  staffList: StaffOption[];
  countries: CountryOption[];
  isAdmin: boolean;
  currentStaffId: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Record<string, Duplicate[]>>({});

  const run = async (id: string, operation: () => Promise<void>) => {
    setBusy(id);
    setMessage(null);
    setError(null);
    try {
      await operation();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lead işlemi tamamlanamadı.");
    } finally {
      setBusy(null);
    }
  };

  const createLead = async (formData: FormData) => {
    await run("create", async () => {
      const { error: rpcError } = await supabase.rpc("create_lead_v1", {
        p_payload: {
          first_name: String(formData.get("first_name") ?? ""),
          last_name: String(formData.get("last_name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          source: String(formData.get("source") ?? "diger"),
          campaign: String(formData.get("campaign") ?? ""),
          referral: String(formData.get("referral") ?? ""),
          target_country: String(formData.get("target_country") ?? ""),
          visa_type: String(formData.get("visa_type") ?? "turistik"),
          assigned_staff_id: String(formData.get("assigned_staff_id") ?? currentStaffId),
          follow_up_due_at: String(formData.get("follow_up_due_at") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        },
      });
      if (rpcError) throw rpcError;
      setMessage("Lead kaydı oluşturuldu.");
    });
  };

  const updateStatus = async (lead: Lead, status: string) => {
    await run(lead.id, async () => {
      const { error: rpcError } = await supabase.rpc("update_lead_v1", {
        p_lead_id: lead.id,
        p_payload: { status, event_note: `Durum ${statusLabels[status] ?? status} olarak güncellendi.` },
      });
      if (rpcError) throw rpcError;
      setMessage("Lead durumu güncellendi.");
    });
  };

  const checkDuplicates = async (lead: Lead) => {
    await run(`duplicate-${lead.id}`, async () => {
      const { data, error: rpcError } = await supabase.rpc("find_lead_duplicates_v1", {
        p_lead_id: lead.id,
      });
      if (rpcError) throw rpcError;
      setDuplicates(current => ({ ...current, [lead.id]: data ?? [] }));
      setMessage(data?.length ? `${data.length} olası eşleşme bulundu.` : "Olası mükerrer kayıt bulunmadı.");
    });
  };

  const convertLead = async (lead: Lead, formData: FormData) => {
    await run(`convert-${lead.id}`, async () => {
      const existingCustomerId = String(formData.get("existing_customer_id") ?? "");
      const { data, error: rpcError } = await supabase.rpc("convert_lead_v1", {
        p_lead_id: lead.id,
        p_payload: {
          existing_customer_id: existingCustomerId || null,
          confirm_new_customer: formData.get("confirm_new_customer") === "on",
          country_id: String(formData.get("country_id") ?? ""),
          visa_type: lead.visa_type,
        },
      });
      if (rpcError) throw rpcError;
      const customerId = data && typeof data === "object" && !Array.isArray(data)
        ? String(data.customer_id ?? "")
        : "";
      setMessage("Lead müşteri ve başvuru kaydına dönüştürüldü.");
      if (customerId) router.push(`/customers/${customerId}`);
    });
  };

  const funnel = Object.keys(statusLabels).map(status => ({
    status,
    count: initialLeads.filter(lead => lead.status === status).length,
  }));

  return (
    <main className="min-h-screen bg-white p-6 dark:bg-[#060d1a]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <UserRoundSearch className="h-5 w-5 text-blue-500" /> Lead Yönetimi
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Kaynak, takip SLA&apos;sı, mükerrer eşleşme ve kontrollü müşteri dönüşümü.
          </p>
        </header>
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
        {message && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600">{message}</p>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {funnel.map(item => (
            <div key={item.status} className="rounded-xl border border-slate-200 p-3 dark:border-[#1f2937] dark:bg-[#0d1420]">
              <p className="text-[10px] uppercase text-slate-500">{statusLabels[item.status]}</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{item.count}</p>
            </div>
          ))}
        </section>

        <form action={createLead} className="grid gap-3 rounded-2xl border border-slate-200 p-5 dark:border-[#1f2937] dark:bg-[#0d1420] md:grid-cols-4">
          <h2 className="md:col-span-4 text-sm font-semibold text-slate-900 dark:text-white"><Plus className="mr-1 inline h-4 w-4" />Yeni lead</h2>
          <input required name="first_name" placeholder="Ad" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <input required name="last_name" placeholder="Soyad" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <input name="phone" placeholder="Telefon" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <input name="email" type="email" placeholder="E-posta" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <select name="source" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]">
            <option value="web">Web</option><option value="telefon">Telefon</option>
            <option value="whatsapp">WhatsApp</option><option value="referans">Referans</option>
            <option value="sosyal_medya">Sosyal medya</option><option value="ofis">Ofis</option>
            <option value="diger">Diğer</option>
          </select>
          <input name="campaign" placeholder="Kampanya" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <input name="referral" placeholder="Yönlendiren" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <input name="target_country" placeholder="Hedef ülke" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <select name="visa_type" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]">
            <option value="turistik">Turistik</option><option value="is">İş</option>
            <option value="ogrenci">Öğrenci</option><option value="aile_ziyareti">Aile ziyareti</option>
            <option value="diger">Diğer</option>
          </select>
          <input name="follow_up_due_at" type="datetime-local" aria-label="Takip zamanı" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          {isAdmin ? (
            <select name="assigned_staff_id" defaultValue={currentStaffId} className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]">
              {staffList.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}
            </select>
          ) : <input type="hidden" name="assigned_staff_id" value={currentStaffId} />}
          <input name="notes" placeholder="Not" className="rounded-xl border p-2.5 text-sm dark:border-[#1f2937] dark:bg-[#060d1a]" />
          <button disabled={busy !== null} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Lead ekle</button>
        </form>

        <section className="space-y-3">
          {initialLeads.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Henüz lead yok.</p>}
          {initialLeads.map(lead => (
            <article key={lead.id} className="rounded-2xl border border-slate-200 p-5 dark:border-[#1f2937] dark:bg-[#0d1420]">
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{lead.first_name} {lead.last_name}</h3>
                  <p className="text-xs text-slate-500">{lead.phone || "Telefon yok"} · {lead.source} · {lead.target_country || "Ülke yok"}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Takip: {lead.follow_up_due_at ? new Date(lead.follow_up_due_at).toLocaleString("tr-TR") : "Planlanmadı"}</p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <select value={lead.status} disabled={lead.status === "converted" || busy !== null} onChange={event => void updateStatus(lead, event.target.value)} className="rounded-lg border px-2 py-1.5 text-xs dark:border-[#1f2937] dark:bg-[#060d1a]">
                    {Object.entries(statusLabels).filter(([value]) => value !== "converted").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    {lead.status === "converted" && <option value="converted">Dönüştürüldü</option>}
                  </select>
                  <button type="button" onClick={() => void checkDuplicates(lead)} disabled={busy !== null} className="rounded-lg border px-3 py-1.5 text-xs font-semibold dark:border-[#334155]">
                    {busy === `duplicate-${lead.id}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 inline h-3.5 w-3.5" />}Eşleşme
                  </button>
                </div>
              </div>
              {duplicates[lead.id] && (
                <div className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs">
                  {duplicates[lead.id].length === 0 ? "Eşleşme yok." : duplicates[lead.id].map(item => (
                    <p key={`${item.entity_type}-${item.entity_id}`}>{item.entity_type}: {item.display_name} — {item.match_reason}</p>
                  ))}
                </div>
              )}
              {lead.status !== "converted" && (
                <form action={formData => convertLead(lead, formData)} className="mt-4 grid gap-2 border-t border-slate-200 pt-4 dark:border-[#1f2937] md:grid-cols-4">
                  <select required name="country_id" defaultValue="" className="rounded-lg border px-2 py-2 text-xs dark:border-[#1f2937] dark:bg-[#060d1a]">
                    <option value="" disabled>Başvuru ülkesi</option>
                    {countries.map(country => <option key={country.id} value={country.id}>{country.name}</option>)}
                  </select>
                  <select name="existing_customer_id" defaultValue="" className="rounded-lg border px-2 py-2 text-xs dark:border-[#1f2937] dark:bg-[#060d1a]">
                    <option value="">Yeni müşteri oluştur</option>
                    {(duplicates[lead.id] ?? []).filter(item => item.entity_type === "customer").map(item => <option key={item.entity_id} value={item.entity_id}>Mevcut: {item.display_name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" name="confirm_new_customer" />Eşleşmeye rağmen yeni kayıt</label>
                  <button disabled={busy !== null} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><ArrowRight className="mr-1 inline h-3.5 w-3.5" />Müşteriye dönüştür</button>
                </form>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
