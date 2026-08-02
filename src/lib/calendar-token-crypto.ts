const MAGIC = new TextEncoder().encode("NVC1");
const IV_BYTES = 12;

function decodeBase64(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function cryptoBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value);
}

export function parseCalendarTokenEncryptionKey(value: string | undefined) {
  if (!value) {
    throw Object.assign(new Error("calendar_token_encryption_key_missing"), {
      code: "calendar_token_encryption_key_missing",
    });
  }
  const key = decodeBase64(value);
  if (key.byteLength !== 32) {
    throw Object.assign(new Error("calendar_token_encryption_key_invalid"), {
      code: "calendar_token_encryption_key_invalid",
    });
  }
  return key;
}

export async function encryptCalendarToken(token: string, rawKey: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await crypto.subtle.importKey("raw", cryptoBytes(rawKey), "AES-GCM", false, ["encrypt"]);
  const plaintext = new TextEncoder().encode(token);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    cryptoBytes(plaintext),
  ));
  const artifact = new Uint8Array(MAGIC.length + IV_BYTES + ciphertext.length);
  artifact.set(MAGIC, 0);
  artifact.set(iv, MAGIC.length);
  artifact.set(ciphertext, MAGIC.length + IV_BYTES);
  return Buffer.from(artifact).toString("base64");
}

export async function decryptCalendarToken(ciphertext: string, rawKey: Uint8Array) {
  const artifact = decodeBase64(ciphertext);
  if (
    artifact.byteLength <= MAGIC.length + IV_BYTES
    || !MAGIC.every((byte, index) => artifact[index] === byte)
  ) {
    throw Object.assign(new Error("calendar_token_ciphertext_invalid"), {
      code: "calendar_token_ciphertext_invalid",
    });
  }
  const iv = artifact.slice(MAGIC.length, MAGIC.length + IV_BYTES);
  const encrypted = artifact.slice(MAGIC.length + IV_BYTES);
  const key = await crypto.subtle.importKey("raw", cryptoBytes(rawKey), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cryptoBytes(encrypted));
  return new TextDecoder().decode(plaintext);
}
