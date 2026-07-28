import { createHash } from "node:crypto";

export function loginAttemptKey(email: string, forwardedFor: string | null) {
  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
  const address = (forwardedFor ?? "unknown").split(",")[0]?.trim() || "unknown";
  return createHash("sha256")
    .update(`nobel-crm-login-v1|${normalizedEmail}|${address}`)
    .digest("hex");
}

export function retryAfterMessage(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Çok fazla başarısız giriş denemesi yapıldı. ${minutes} dakika sonra tekrar deneyin.`;
}
