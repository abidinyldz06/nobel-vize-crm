import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function storagePath(value: string) {
  if (!value.startsWith("http")) return value;
  for (const marker of ["/storage/v1/object/public/documents/", "/storage/v1/object/sign/documents/"]) {
    const index = value.indexOf(marker);
    if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  return null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { id } = await params;
  const { data: candidates, error: candidateError } = await supabase.rpc("list_archived_customer_privacy_v1");
  if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 400 });
  const candidate = candidates?.find(item => item.customer_id === id);
  if (!candidate?.request_id) return NextResponse.json({ error: "Onaylanmış silme veya anonimleştirme talebi bulunmuyor." }, { status: 400 });
  if (!candidate.grace_eligible) return NextResponse.json({ error: "Arşiv bekleme süresi henüz dolmadı." }, { status: 400 });
  if (candidate.retention_hold_active) return NextResponse.json({ error: "Aktif saklama kilidi nedeniyle evraklar silinemez." }, { status: 409 });

  const admin = createSupabaseAdminClient();
  const { data: applications, error: applicationError } = await admin.from("applications").select("id").eq("customer_id", id);
  if (applicationError) return NextResponse.json({ error: applicationError.message }, { status: 500 });
  const applicationIds = (applications ?? []).map(application => application.id);
  if (applicationIds.length === 0) return NextResponse.json({ success: true, deleted: 0 });
  const { data: documents, error: documentError } = await admin.from("documents").select("id, file_url").in("application_id", applicationIds).not("file_url", "is", null);
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 });
  const unresolved = (documents ?? []).filter(document => document.file_url && !storagePath(document.file_url));
  if (unresolved.length > 0) return NextResponse.json({ error: "Bazı Storage yolları güvenli biçimde çözümlenemedi; işlem durduruldu." }, { status: 409 });
  const paths = (documents ?? []).flatMap(document => document.file_url ? [storagePath(document.file_url)].filter((value): value is string => Boolean(value)) : []);
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from("documents").remove(paths);
    if (removeError) return NextResponse.json({ error: "Storage dosyaları silinemedi; veritabanı değiştirilmedi." }, { status: 500 });
  }
  const documentIds = (documents ?? []).map(document => document.id);
  const { data: changed, error: markError } = await supabase.rpc("mark_customer_documents_deleted_v1", { p_customer_id: id, p_document_ids: documentIds });
  if (markError) return NextResponse.json({ error: markError.message }, { status: 400 });
  return NextResponse.json({ success: true, deleted: changed ?? 0 });
}
