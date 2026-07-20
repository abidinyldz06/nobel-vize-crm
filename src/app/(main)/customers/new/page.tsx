import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createCustomerWithApplication } from "@/app/actions/customer";
import { UserPlus, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import SmartDocumentSelector from "@/components/SmartDocumentSelector";

export const revalidate = 0;

export default async function NewCustomerPage() {
  const supabase = await createSupabaseServerClient();
  // countries tablosundan kayıtlı ülkeleri çek
  const { data: dbCountries } = await supabase.from('countries').select('id, name').order('name');
  const { data: allRules } = await supabase.from('country_visa_rules').select('*');
  // staff tablosundan danışmanları çek
  const { data: staffList } = await supabase.from('staff').select('id, full_name, role').eq('is_active', true).order('full_name');

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-7">
          <Link href="/customers" className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" /> Yeni Müşteri Ekle
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">Müşteri bilgilerini girin ve başvuru dosyasını oluşturun.</p>
          </div>
        </div>

        <form action={createCustomerWithApplication} className="space-y-5">
          {/* Kişisel Bilgiler */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kişisel Bilgiler</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad <span className="text-red-400">*</span></label>
                <input required name="firstName" type="text"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Örnek: Ahmet" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Soyad <span className="text-red-400">*</span></label>
                <input required name="lastName" type="text"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Örnek: Yılmaz" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon <span className="text-red-400">*</span></label>
                <input required name="phone" type="tel"
                  pattern="0[0-9]{10}" maxLength={11}
                  title="Telefon 0 ile başlamalı ve 11 haneli olmalı (örn: 05551234567)"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="0XXXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta</label>
                <input name="email" type="email"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="ornek@email.com" />
              </div>
            </div>
          </div>

          {/* Pasaport Bilgileri */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pasaport Bilgileri</h2>
              <p className="text-xs text-slate-500 mt-0.5">Başvuru süreci ve uyarılar için gereklidir.</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pasaport No <span className="text-red-400">*</span></label>
                <input required name="passportNo" type="text"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                  placeholder="Örnek: U1234567" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bitiş Tarihi <span className="text-red-400">*</span></label>
                <input required name="passportExpiry" type="date"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Verildiği Ülke</label>
                <input name="passportIssuingCountry" type="text" defaultValue="Türkiye"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Örnek: Türkiye" />
              </div>
            </div>
          </div>

          {/* Vize Başvurusu */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Vize Başvurusu</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ülke seçilirse evrak listesi otomatik oluşturulur.</p>
            </div>
            <div className="px-6 py-5 space-y-4">

              <SmartDocumentSelector dbCountries={dbCountries || []} allRules={allRules || []} />

              {/* Danışman Ataması */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sorumlu Danışman</label>
                <select name="assignedStaffId"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer">
                  <option value="">— Danışman Seçin (İsteğe bağlı) —</option>
                  {staffList?.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.role === 'admin' ? '(Yönetici)' : '(Danışman)'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-600">Seçilen danışman bu müşteriyi kendi panelinde görebilir.</p>
              </div>

              {/* Danışman Notu */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Danışman Notu</label>
                <textarea name="consultantNote" rows={3}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                  placeholder="Müşteri hakkında kısa not... (ör: Daha önce Almanya reddi var, SGK borcu mevcut)" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/customers" className="px-5 py-2.5 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors">
              İptal
            </Link>
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
              <Save className="w-4 h-4" />
              Kaydet ve Dosya Aç
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
