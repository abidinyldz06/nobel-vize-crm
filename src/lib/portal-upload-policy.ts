export const MAX_PORTAL_UPLOAD_BYTES = 10 * 1024 * 1024;

const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export type PortalUploadInput = {
  fileName: string;
  contentType: string;
  size: number;
};

export function validatePortalUploadInput(input: PortalUploadInput) {
  const fileName = input.fileName.trim();
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const expectedContentType = contentTypesByExtension[extension];
  if (!fileName || fileName.length > 160 || /[\\/\u0000-\u001f]/.test(fileName)) {
    return { ok: false as const, error: "Dosya adı geçersiz." };
  }
  if (!expectedContentType || input.contentType !== expectedContentType) {
    return { ok: false as const, error: "Yalnız PDF, JPG veya PNG dosyası yüklenebilir." };
  }
  if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_PORTAL_UPLOAD_BYTES) {
    return { ok: false as const, error: "Dosya boyutu 10 MB veya daha küçük olmalıdır." };
  }
  return { ok: true as const, fileName, extension, contentType: expectedContentType, size: input.size };
}
