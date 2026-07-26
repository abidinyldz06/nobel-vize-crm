import { requireAdminPage } from "@/lib/page-auth";
import { Settings } from "lucide-react";
import SettingsClient from "@/components/SettingsClient";

export const revalidate = 0;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { supabase } = await requireAdminPage();
  const { tab } = await searchParams;

  const [
    { data: company, error },
    { data: templates, error: templatesError },
    { data: privacyNotices, error: privacyError },
    { data: privacySettings, error: settingsError },
    { data: operationalEvents, error: operationalEventsError },
    { data: backupRuns, error: backupRunsError },
  ] = await Promise.all([
    supabase.from('tenants').select('id, company_name, email, phone, created_at').single(),
    supabase.from('message_templates').select('*').order('channel').order('name'),
    supabase.from('privacy_notice_versions').select('*').order('effective_at', { ascending: false }),
    supabase.from('privacy_settings').select('*').single(),
    supabase.from('operational_events').select('*').order('last_seen_at', { ascending: false }).limit(50),
    supabase.from('backup_runs').select('*').order('started_at', { ascending: false }).limit(20),
  ]);

  if (error || !company || templatesError || privacyError || settingsError || !privacySettings || operationalEventsError || backupRunsError) {
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
        <SettingsClient
          company={company}
          messageTemplates={templates ?? []}
          privacyNotices={privacyNotices ?? []}
          privacySettings={privacySettings}
          operationalEvents={operationalEvents ?? []}
          backupRuns={backupRuns ?? []}
          initialTab={tab}
        />
      </div>
    </div>
  );
}
