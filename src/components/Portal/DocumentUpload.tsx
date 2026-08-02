"use client";

import { useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { validatePortalUploadInput } from "@/lib/portal-upload-policy";

type PortalDocumentUploadProps = {
  token: string;
  document: {
    id: string;
    document_type: string | null;
    status: string | null;
  };
};

async function errorFrom(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || "Evrak yüklenemedi.";
}

export default function PortalDocumentUpload({ token, document }: PortalDocumentUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file || uploading) return;
    const input = validatePortalUploadInput({ fileName: file.name, contentType: file.type, size: file.size });
    if (!input.ok) {
      setMessage(input.error);
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const base = `/api/portal/${encodeURIComponent(token)}`;
      const uploadUrl = await fetch(`${base}/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: document.id, fileName: input.fileName, contentType: input.contentType, size: input.size }),
      });
      if (!uploadUrl.ok) throw new Error(await errorFrom(uploadUrl));
      const signed = await uploadUrl.json() as { path?: string; token?: string };
      if (!signed.path || !signed.token) throw new Error("Güvenli yükleme bağlantısı alınamadı.");

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: input.contentType, upsert: false });
      if (uploadError) throw uploadError;

      const commit = await fetch(`${base}/commit-upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: document.id, path: signed.path, fileName: input.fileName, contentType: input.contentType, size: input.size }),
      });
      if (!commit.ok) throw new Error(await errorFrom(commit));
      setMessage("Evrak yüklendi. Danışman incelemesi bekleniyor.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evrak yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  if (document.status === "onaylandi") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="Danışman tarafından onaylandı" />;
  }

  return (
    <div data-testid={`portal-document-upload-${document.id}`} className="mt-2 print:hidden">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-500/20 dark:text-blue-300">
        <UploadCloud className="h-3.5 w-3.5" />
        {uploading ? "Yükleniyor..." : document.status === "yuklendi" ? "Tekrar yükle" : "Dosya yükle"}
        <input
          type="file"
          data-testid={`portal-document-file-${document.id}`}
          className="sr-only"
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          disabled={uploading}
          onChange={event => {
            void upload(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {message && <p className="mt-1 max-w-40 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{message}</p>}
    </div>
  );
}
