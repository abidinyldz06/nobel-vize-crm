import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function extractStoragePath(value: string) {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return value;

  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/documents/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { id } = await params;
  const { data: document, error } = await context.supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .single();

  if (error || !document?.file_url) {
    return NextResponse.json({ error: "Dosya bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  }

  const storagePath = extractStoragePath(document.file_url);
  if (!storagePath) {
    return NextResponse.json({ error: "Geçersiz dosya yolu." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error: signedUrlError } = await adminClient.storage
    .from("documents")
    .createSignedUrl(storagePath, 60);

  if (signedUrlError || !data?.signedUrl) {
    return NextResponse.json({ error: "Güvenli dosya bağlantısı oluşturulamadı." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
