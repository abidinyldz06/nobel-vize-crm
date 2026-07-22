export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
}

export function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return `${value.slice(0, 1)}•••`;
  const [domainName, ...suffix] = domain.split(".");
  return `${local.slice(0, 1)}•••@${domainName.slice(0, 1)}•••${suffix.length ? `.${suffix.join(".")}` : ""}`;
}

export function maskPassport(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 4) return "••••";
  return `${normalized.slice(0, 2)}${"•".repeat(Math.min(6, normalized.length - 4))}${normalized.slice(-2)}`;
}

export function maskSensitive(value: string, kind: "phone" | "email" | "passport") {
  if (kind === "phone") return maskPhone(value);
  if (kind === "email") return maskEmail(value);
  return maskPassport(value);
}
