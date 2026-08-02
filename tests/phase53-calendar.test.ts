import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { decryptCalendarToken, encryptCalendarToken, parseCalendarTokenEncryptionKey } from "../src/lib/calendar-token-crypto.ts";

const root = process.cwd();

describe("phase 5.3 Google Calendar security boundary", () => {
  it("encrypts OAuth tokens with authenticated AES-GCM", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const ciphertext = await encryptCalendarToken("refresh-token-only-in-server-storage", key);
    assert.notEqual(ciphertext, "refresh-token-only-in-server-storage");
    assert.equal(await decryptCalendarToken(ciphertext, key), "refresh-token-only-in-server-storage");
    assert.equal(parseCalendarTokenEncryptionKey(Buffer.from(key).toString("base64")).byteLength, 32);
    await assert.rejects(() => decryptCalendarToken(`${ciphertext.slice(0, -4)}AAAA`, key));
  });

  it("keeps OAuth state signed, expiring and offline-refresh capable", async () => {
    const source = await readFile(path.join(root, "src/lib/google-calendar-oauth.ts"), "utf8");
    assert.match(source, /createHmac\("sha256", secret\)/);
    assert.match(source, /timingSafeEqual/);
    assert.match(source, /Date\.now\(\) \+ 10 \* 60_000/);
    assert.match(source, /access_type: "offline"/);
    assert.match(source, /https:\/\/www\.googleapis\.com\/auth\/calendar\.events/);
  });
});
