import PrivacyLifecycleDashboard from "@/components/PrivacyLifecycleDashboard";
import { requireAdminPage } from "@/lib/page-auth";

export const revalidate = 0;

export default async function PrivacyPage() {
  const { supabase, staff } = await requireAdminPage();
  const [
    { data: candidates, error: candidateError },
    { data: actions, error: actionError },
    { data: approvals, error: approvalError },
    { data: audit, error: auditError },
  ] = await Promise.all([
    supabase.rpc("list_privacy_lifecycle_candidates_v1"),
    supabase
      .from("privacy_action_queue")
      .select("*, customers(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("privacy_action_approvals").select("*"),
    supabase
      .from("privacy_audit_log")
      .select("*, staff(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const loadError = candidateError ?? actionError ?? approvalError ?? auditError;

  return (
    <PrivacyLifecycleDashboard
      candidates={candidates ?? []}
      actions={actions ?? []}
      approvals={approvals ?? []}
      audit={audit ?? []}
      currentStaffId={staff.id}
      loadError={loadError?.message ?? null}
    />
  );
}
