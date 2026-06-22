import { supabase } from "@/lib/supabase";
import { addAppointment } from "@/app/actions/update-customer";
import { Calendar, Save, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function AddAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();
  const { data: applications } = await supabase
    .from('applications')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  const activeApp = applications?.[0];

  if (!customer) return <div className="p-6 text-slate-500 dark:text-slate-400">Müşteri bulunamadı.</div>;
  if (!activeApp) return (
    <div className="p-6 flex items-center gap-2 text-slate-500 dark:text-slate-400">
      <AlertCircle className="w-5 h-5" /> Aktif başvuru bulunamadı. Önce müşteri oluşturun.
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <Link href={`/customers/${id}`} className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" /> Randevu Ekle
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {customer.first_name} {customer.last_name} — {activeApp.country} Vizesi
            </p>
          </div>
        </div>

        <form action={addAppointment} className="space-y-5">
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="applicationId" value={activeApp.id} />

          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Randevu Detayları</h2>
              <p className="text-xs text-slate-500 mt-0.5">Başvuru sistemi, tarih ve konum bilgilerini girin.</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* System Selection */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Başvuru Sistemi *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "VFS", label: "VFS Global", desc: "Schengen, UK, ABD" },
                    { value: "iDATA", label: "iDATA", desc: "Almanya, Fransa vb." },
                    { value: "Konsolosluk", label: "Konsolosluk", desc: "Diğer ülkeler" },
                  ].map(sys => (
                    <label key={sys.value} className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-[#1f2937] cursor-pointer hover:border-blue-500/40 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-500/10 transition-all">
                      <input type="radio" name="appointmentSystem" value={sys.value} defaultChecked={sys.value === "VFS"} className="sr-only" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{sys.label}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{sys.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarih *</label>
                <input
                  required name="date" type="date"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saat *</label>
                <input
                  required name="time" type="time"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Merkez / Konum *</label>
                <input
                  required name="location" type="text"
                  placeholder="Örn: VFS Global Altunizade, iDATA Harbiye, Fransız Konsolosluğu"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Not (isteğe bağlı)</label>
                <textarea
                  name="appointmentNote" rows={2}
                  placeholder="Randevu ile ilgili eklemek istediğiniz bilgiler..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href={`/customers/${id}`} className="px-5 py-2.5 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors">
              İptal
            </Link>
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
              <Save className="w-4 h-4" /> Randevuyu Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
