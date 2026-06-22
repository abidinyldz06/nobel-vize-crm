import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateCustomer } from "@/app/actions/update-customer";
import { Edit2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();
  const { data: staffList } = await supabase.from('staff').select('id, full_name, role').eq('is_active', true).order('full_name');

  if (!customer) return <div className="p-6 text-slate-500 dark:text-slate-400">Müşteri bulunamadı.</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <Link href={`/customers/${id}`} className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-400" /> Müşteri Düzenle
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">{customer.first_name} {customer.last_name} bilgilerini düzenleyin.</p>
          </div>
        </div>

        <form action={updateCustomer} className="space-y-5">
          <input type="hidden" name="id" value={customer.id} />

          {/* Kişisel Bilgiler */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kişisel Bilgiler</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad</label>
                <input required name="firstName" type="text" defaultValue={customer.first_name}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Soyad</label>
                <input required name="lastName" type="text" defaultValue={customer.last_name}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon</label>
                <input required name="phone" type="tel" defaultValue={customer.phone || ''}
                  pattern="0[0-9]{10}" maxLength={11}
                  title="Telefon 0 ile başlamalı ve 11 haneli olmalı (örn: 05551234567)"
                  placeholder="0XXXXXXXXXX"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta</label>
                <input name="email" type="email" defaultValue={customer.email || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
            </div>
          </div>

          {/* Finansal Bilgiler */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Finansal & Profil Bilgileri</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Finansal Durum</label>
                <select name="financialStatus" defaultValue={customer.financial_status || 'orta'}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none">
                  <option value="dusuk">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="iyi">İyi</option>
                  <option value="yuksek">Yüksek</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aylık Gelir (₺)</label>
                <input name="monthlyIncome" type="number" min="0" step="1000" defaultValue={customer.monthly_income || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Örn: 30000" />
              </div>
            </div>
          </div>

          {/* Pasaport Bilgileri */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pasaport Bilgileri</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pasaport No</label>
                <input name="passportNo" type="text" defaultValue={customer.passport_no || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                  placeholder="Örnek: U1234567" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bitiş Tarihi</label>
                <input name="passportExpiry" type="date" defaultValue={customer.passport_expiry || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Verildiği Ülke</label>
                <input name="passportIssuingCountry" type="text" defaultValue={customer.passport_issuing_country || 'Türkiye'}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
            </div>
          </div>

          {/* Danışman Ataması */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Danışman Ataması</h2>
            </div>
            <div className="px-6 py-5">
              <select name="assignedStaffId" defaultValue={customer.assigned_staff_id || ''}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer">
                <option value="">— Danışman Seçin —</option>
                {staffList?.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.role === 'admin' ? '(Yönetici)' : '(Danışman)'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-600 mt-1.5">Seçilen danışman bu müşterinin sorumlusu olur.</p>
            </div>
          </div>

          {/* Danışman Notu */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Danışman Notu</h2>
            </div>
            <div className="px-6 py-5">
              <textarea name="notes" rows={3} defaultValue={customer.notes || ''}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                placeholder="Müşteri hakkında not..." />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href={`/customers/${id}`} className="px-5 py-2.5 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors">
              İptal
            </Link>
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
              <Save className="w-4 h-4" />
              Değişiklikleri Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
