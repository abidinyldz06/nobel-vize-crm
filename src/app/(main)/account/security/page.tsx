import AccountSecurityPanel from "@/components/AccountSecurityPanel";
import { requireStaffPage } from "@/lib/page-auth";

export default async function AccountSecurityPage() {
  const { supabase, staff } = await requireStaffPage();
  const { data: company, error } = await supabase
    .from("tenants")
    .select("admin_mfa_required, consultant_mfa_required")
    .single();
  if (error || !company) throw new Error("Güvenlik politikası yüklenemedi.");
  const mfaRequired = staff.role === "admin"
    ? company.admin_mfa_required
    : company.consultant_mfa_required;

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-[#060d1a]">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hesap Güvenliği</h1>
        <p className="mb-6 mt-1 text-xs text-slate-500">İki adımlı doğrulama ve aktif cihazlarınızı yönetin.</p>
        <AccountSecurityPanel mfaRequired={mfaRequired} />
      </div>
    </div>
  );
}
