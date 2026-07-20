function hexToBytes(hex: string) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
}

export async function verifyHmacSha256Signature(
  secret: string,
  timestamp: string,
  eventId: string,
  rawBody: string,
  signatureHeader: string,
) {
  const signature = hexToBytes(signatureHeader.replace(/^sha256=/i, ""));
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`${timestamp}.${eventId}.${rawBody}`),
  );
}
