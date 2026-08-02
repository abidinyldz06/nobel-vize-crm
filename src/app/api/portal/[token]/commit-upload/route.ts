import { NextResponse } from "next/server";
import { getActivePortalCustomer } from "@/lib/portal-access";
import { validatePortalUploadInput } from "@/lib/portal-upload-policy";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CommitUploadPayload = {
  documentId?: string;
  path?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
};

function storageMetadata(value: unknown) {
  if (!value || typeof value !== "object") return { size: null, contentType: null };
  const record = value as Record<string, unknown>;
  const rawSize = record.size;
  return {
    size: typeof rawSize === "number"
      ? rawSize
      : typeof rawSize === "string" && /^\d+$/.test(rawSize) ? Number(rawSize) : null,
    contentType: typeof record.mimetype === "string" ? record.mimetype : null,
  };
}

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await getActivePortalCustomer(token);
  if (!customer) return NextResponse.json({ error: "Portal bağlantısı geçersiz veya süresi dolmuş." }, { status: 404 });

  let payload: CommitUploadPayload;
  try {
    payload = await request.json() as CommitUploadPayload;
  } catch {
    return NextResponse.json({ error: "Geçersiz yükleme isteği." }, { status: 400 });
  }
  if (!payload.documentId || !/^[0-9a-f-]{36}$/i.test(payload.documentId) || typeof payload.path !== "string") {
    return NextResponse.json({ error: "Evrak yükleme kaydı geçersiz." }, { status: 400 });
  }
  const input = validatePortalUploadInput({
    fileName: typeof payload.fileName === "string" ? payload.fileName : "",
    contentType: typeof payload.contentType === "string" ? payload.contentType : "",
    size: typeof payload.size === "number" ? payload.size : Number.NaN,
  });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const expectedPrefix = `portal/${customer.id}/${payload.documentId}/`;
  if (!payload.path.startsWith(expectedPrefix) || !payload.path.endsWith(`.${input.extension}`)) {
    return NextResponse.json({ error: "Dosya yolu doğrulanamadı." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const storedFileName = payload.path.slice(expectedPrefix.length);
  const { data: objects, error: listError } = await admin.storage
    .from("documents")
    .list(expectedPrefix, { limit: 10, search: storedFileName });
  const object = objects?.find(candidate => candidate.name === storedFileName);
  const metadata = storageMetadata(object?.metadata);
  if (listError || !object || metadata.size !== input.size || metadata.contentType !== input.contentType) {
    await admin.storage.from("documents").remove([payload.path]);
    return NextResponse.json({ error: "Yüklenen dosya doğrulanamadı." }, { status: 400 });
  }

  const { data: existingDocument } = await admin.from("documents").select("file_url").eq("id", payload.documentId).maybeSingle();
  const { error } = await admin.rpc("record_portal_document_upload_v1", {
    p_customer_id: customer.id,
    p_document_id: payload.documentId,
    p_storage_path: payload.path,
    p_file_name: input.fileName,
    p_content_type: input.contentType,
    p_file_size_bytes: input.size,
  });
  if (error) {
    await admin.storage.from("documents").remove([payload.path]);
    return NextResponse.json({ error: "Evrak danışman incelemesine alınamadı." }, { status: 400 });
  }

  const oldPath = existingDocument?.file_url;
  if (oldPath?.startsWith(expectedPrefix) && oldPath !== payload.path) {
    await admin.storage.from("documents").remove([oldPath]);
  }
  return NextResponse.json({ ok: true });
}
