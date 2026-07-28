const MAGIC = new TextEncoder().encode("NVB3");
const IV_BYTES = 12;

function decodeBase64(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function webCryptoBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value);
}

export function parseBackupEncryptionKey(value: string | undefined) {
  if (!value) throw Object.assign(new Error("backup_encryption_key_missing"), { code: "backup_encryption_key_missing" });
  const key = decodeBase64(value);
  if (key.byteLength !== 32) {
    throw Object.assign(new Error("backup_encryption_key_invalid"), { code: "backup_encryption_key_invalid" });
  }
  return key;
}

export async function sha256Hex(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", webCryptoBytes(bytes));
  return Buffer.from(digest).toString("hex");
}

export async function encryptBackupPayload(plaintext: Uint8Array, rawKey: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await crypto.subtle.importKey("raw", webCryptoBytes(rawKey), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    webCryptoBytes(plaintext),
  ));
  const output = new Uint8Array(MAGIC.length + iv.length + ciphertext.length);
  output.set(MAGIC, 0);
  output.set(iv, MAGIC.length);
  output.set(ciphertext, MAGIC.length + iv.length);
  return output;
}

export async function decryptBackupPayload(artifact: Uint8Array, rawKey: Uint8Array) {
  if (
    artifact.byteLength <= MAGIC.length + IV_BYTES
    || !MAGIC.every((byte, index) => artifact[index] === byte)
  ) {
    throw Object.assign(new Error("backup_artifact_invalid"), { code: "backup_artifact_invalid" });
  }
  const iv = artifact.slice(MAGIC.length, MAGIC.length + IV_BYTES);
  const ciphertext = artifact.slice(MAGIC.length + IV_BYTES);
  const key = await crypto.subtle.importKey("raw", webCryptoBytes(rawKey), "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
}
