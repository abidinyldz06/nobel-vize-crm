import { requireAdminPage } from "@/lib/page-auth";
import { Settings } from "lucide-react";
import SettingsClient from "@/components/SettingsClient";

export const revalidate = 0;

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();

  const { data: company, error } = await supabase
    .from('tenants')
    .select('id, company_name, email, phone, created_at')
    .single();

  if (error || !company) {
    throw new Error("Tek şirket ayarları yüklenemedi.");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" /> Sistem Ayarları
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Nobel Vize şirket bilgilerini, güvenliği ve sistem verilerini yönetin.</p>
        </div>
        <SettingsClient company={company} />
      </div>
    </div>
  );
}
