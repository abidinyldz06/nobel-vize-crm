import { createHash } from "node:crypto";

export function portalAttemptKeys(forwardedFor: string | null, reference: string) {
  const address = (forwardedFor ?? "unknown").split(",")[0]?.trim() || "unknown";
  const pair = createHash("sha256")
    .update(`nobel-crm-portal-v1|pair|${address}|${reference}`)
    .digest("hex");
  const ip = createHash("sha256")
    .update(`nobel-crm-portal-v1|ip|${address}`)
    .digest("hex");
  return { pair, ip };
}
