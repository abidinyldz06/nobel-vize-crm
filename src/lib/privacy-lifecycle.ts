import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function storagePath(value: string) {
  if (!value.startsWith("http")) return value;
  for (const marker of ["/storage/v1/object/public/documents/", "/storage/v1/object/sign/documents/"]) {
    const index = value.indexOf(marker);
    if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  return null;
}

export async function executeApprovedPrivacyAction(actionId: string) {
  const admin = createSupabaseAdminClient();
  const { data: action, error: actionError } = await admin
    .from("privacy_action_queue")
    .select("id, customer_id, status")
    .eq("id", actionId)
    .single();
  if (actionError || !action?.customer_id || action.status !== "approved") {
    throw Object.assign(new Error("approved_privacy_action_required"), {
      code: actionError?.code ?? "approved_privacy_action_required",
    });
  }

  const { data: applications, error: applicationError } = await admin
    .from("applications")
    .select("id")
    .eq("customer_id", action.customer_id);
  if (applicationError) throw applicationError;
  const applicationIds = (applications ?? []).map(application => application.id);
  const documents = applicationIds.length === 0
    ? []
    : (await admin
      .from("documents")
      .select("id, file_url")
      .in("application_id", applicationIds)
      .not("file_url", "is", null)).data ?? [];

  const unresolved = documents.filter(document => document.file_url && !storagePath(document.file_url));
  if (unresolved.length > 0) {
    throw Object.assign(new Error("privacy_storage_path_unresolved"), {
      code: "privacy_storage_path_unresolved",
    });
  }
  const paths = documents.flatMap(document =>
    document.file_url
      ? [storagePath(document.file_url)].filter((value): value is string => Boolean(value))
      : [],
  );
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from("documents").remove(paths);
    if (removeError) throw removeError;
  }
  if (documents.length > 0) {
    const { error: markError } = await admin
      .from("documents")
      .update({ file_url: null, storage_deleted_at: new Date().toISOString() })
      .in("id", documents.map(document => document.id));
    if (markError) throw markError;
  }
  if (paths.length > 0) {
    await admin.from("privacy_audit_log").insert({
      action_id: actionId,
      customer_id: action.customer_id,
      event_type: "storage_cleaned",
      reason: "Onaylı KVKK işlemi öncesi private Storage nesneleri temizlendi.",
      metadata: { object_count: paths.length },
    });
  }

  const { data: result, error: executeError } = await admin.rpc(
    "execute_privacy_action_v1",
    { p_action_id: actionId },
  );
  if (executeError) throw executeError;
  return {
    result,
    storageObjectsDeleted: paths.length,
  };
}
