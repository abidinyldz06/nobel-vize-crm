import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(
  authorization: string | null,
  configuredSecret: string | undefined,
) {
  if (!configuredSecret || configuredSecret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${configuredSecret}`, "utf8");
  const actual = Buffer.from(authorization, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function scheduledWindowKey(now = new Date()) {
  return now.toISOString().slice(0, 13) + ":00:00Z";
}
