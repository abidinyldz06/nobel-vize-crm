import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getActivePortalCustomer } from "@/lib/portal-access";
import { validatePortalUploadInput } from "@/lib/portal-upload-policy";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type UploadUrlPayload = {
  documentId?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
};

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await getActivePortalCustomer(token);
  if (!customer) return NextResponse.json({ error: "Portal bağlantısı geçersiz veya süresi dolmuş." }, { status: 404 });

  let payload: UploadUrlPayload;
  try {
    payload = await request.json() as UploadUrlPayload;
  } catch {
    return NextResponse.json({ error: "Geçersiz yükleme isteği." }, { status: 400 });
  }
  if (!payload.documentId || !/^[0-9a-f-]{36}$/i.test(payload.documentId)) {
    return NextResponse.json({ error: "Evrak seçimi geçersiz." }, { status: 400 });
  }
  const input = validatePortalUploadInput({
    fileName: typeof payload.fileName === "string" ? payload.fileName : "",
    contentType: typeof payload.contentType === "string" ? payload.contentType : "",
    size: typeof payload.size === "number" ? payload.size : Number.NaN,
  });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: document } = await admin
    .from("documents")
    .select("id, application_id, applications!inner(customer_id)")
    .eq("id", payload.documentId)
    .eq("applications.customer_id", customer.id)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: "Evrak bulunamadı." }, { status: 404 });

  const storagePath = `portal/${customer.id}/${document.id}/${randomUUID()}.${input.extension}`;
  const { data, error } = await admin.storage.from("documents").createSignedUploadUrl(storagePath);
  if (error || !data?.token) return NextResponse.json({ error: "Güvenli yükleme bağlantısı oluşturulamadı." }, { status: 500 });

  return NextResponse.json({ path: storagePath, token: data.token });
}
