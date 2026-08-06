export type VisaRuleSourceKind = "official" | "secondary";

export type VisaRuleSource = {
  title: string;
  url: string;
  kind: VisaRuleSourceKind;
  checked_at?: string;
  review_due_at?: string;
};

export type VisaRuleSourceStatus =
  | "verified"
  | "review_due"
  | "secondary"
  | "review_pending"
  | "unverified";

export const VISA_RULE_SOURCE_STATUS_LABELS: Record<VisaRuleSourceStatus, string> = {
  verified: "Resmî kaynak doğrulandı",
  review_due: "Yeniden kontrol gerekli",
  secondary: "İkincil kaynak",
  review_pending: "Kaynak kontrolü bekliyor",
  unverified: "Kaynak eklenmemiş",
};

export function parseVisaRuleSources(value: unknown): VisaRuleSource[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];

    const source = entry as Record<string, unknown>;
    const title = typeof source.title === "string" ? source.title.trim() : "";
    const url = typeof source.url === "string" ? source.url.trim() : "";
    const kind = source.kind === "official" || source.kind === "secondary"
      ? source.kind
      : null;

    if (!title || !url || !kind) return [];

    const checkedAt = typeof source.checked_at === "string" ? source.checked_at : null;
    const reviewDueAt = typeof source.review_due_at === "string" ? source.review_due_at : null;

    return [{
      title,
      url,
      kind,
      ...(checkedAt ? { checked_at: checkedAt } : {}),
      ...(reviewDueAt ? { review_due_at: reviewDueAt } : {}),
    }];
  });
}

export function getVisaRuleSourceStatus(
  sources: VisaRuleSource[],
  today = new Date().toISOString().slice(0, 10),
): VisaRuleSourceStatus {
  if (sources.length === 0) return "unverified";

  const checkedOfficial = sources.filter(
    (source) => source.kind === "official" && Boolean(source.checked_at),
  );
  const activeOfficial = checkedOfficial.some(
    (source) => !source.review_due_at || source.review_due_at >= today,
  );

  if (activeOfficial) return "verified";
  if (checkedOfficial.length > 0) return "review_due";
  if (sources.some((source) => source.kind === "secondary" && source.checked_at)) {
    return "secondary";
  }
  return "review_pending";
}
