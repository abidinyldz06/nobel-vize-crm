import { createStaff } from "@/app/actions/staff";
import { Users, Save, ArrowLeft, Shield, User } from "lucide-react";
import Link from "next/link";

export default function NewStaffPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <Link href="/staff" className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> Yeni Personel Ekle
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">Sisteme yeni bir danışman veya yönetici ekleyin.</p>
          </div>
        </div>

        <form action={createStaff} className="space-y-5">
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Personel Bilgileri</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad Soyad *</label>
                  <input
                    required name="fullName" type="text" placeholder="Ahmet Yılmaz"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta *</label>
                  <input
                    required name="email" type="email" placeholder="ahmet@nobelvize.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon</label>
                  <input
                    name="phone" type="tel" placeholder="05XX XXX XX XX"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rol *</label>
                  <select
                    required name="role"
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="consultant">👤 Danışman (kendi müşterilerini görür)</option>
                    <option value="admin">🛡️ Yönetici (tüm verilere erişir)</option>
                  </select>
                </div>
              </div>

              {/* Role info */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                  <div className="flex items-center gap-2 mb-1.5">
                    <User className="w-4 h-4 text-blue-400" />
                    <p className="text-xs font-semibold text-blue-400">Danışman</p>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-0.5">
                    <li>• Sadece atanmış müşterileri görür</li>
                    <li>• Kendi randevu ve evraklarını yönetir</li>
                    <li>• Raporlarda sadece kendi istatistikleri</li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <p className="text-xs font-semibold text-purple-400">Yönetici (Admin)</p>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-0.5">
                    <li>• Tüm müşterileri ve personeli görür</li>
                    <li>• Ülke ve sistem ayarlarını değiştirir</li>
                    <li>• Tüm raporlara erişir</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/staff" className="px-5 py-2.5 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors">
              İptal
            </Link>
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
              <Save className="w-4 h-4" /> Personel Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
