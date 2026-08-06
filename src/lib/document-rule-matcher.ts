export type DocumentRuleProfile = {
  id: string;
  created_at: string;
  travel_method: string | null;
  accommodation: string | null;
  occupation: string | null;
  with_children: boolean | null;
  nationality: string | null;
};

export type DocumentRuleSelection = {
  travel_method?: string | null;
  accommodation?: string | null;
  occupation?: string | null;
  with_children?: string | boolean | null;
  nationality?: string | null;
};

export type DocumentRuleEntry = {
  name: string;
  required: boolean;
  category?: string;
  description?: string;
};

export type DocumentRuleWithDocuments = DocumentRuleProfile & {
  parsedDocuments: DocumentRuleEntry[];
};

export type DocumentRuleResolution<T extends DocumentRuleWithDocuments> = {
  rules: T[];
  documents: DocumentRuleEntry[];
};

const PROFILE_FIELDS = [
  "travel_method",
  "accommodation",
  "occupation",
  "with_children",
  "nationality",
] as const;

function normalizeSelectionValue(value: string | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function normalizeRuleValue(value: string | boolean | null) {
  return value === null ? null : String(value);
}

function ruleSpecificity(rule: DocumentRuleProfile) {
  return PROFILE_FIELDS.reduce(
    (total, field) => total + (normalizeRuleValue(rule[field]) === null ? 0 : 1),
    0,
  );
}

function compareRules(left: DocumentRuleProfile, right: DocumentRuleProfile) {
  return ruleSpecificity(left) - ruleSpecificity(right)
    || left.created_at.localeCompare(right.created_at)
    || left.id.localeCompare(right.id);
}

function isExplicitProfileMatch(
  rule: DocumentRuleProfile,
  selection: DocumentRuleSelection,
) {
  return PROFILE_FIELDS.every(field => {
    const ruleValue = normalizeRuleValue(rule[field]);
    if (ruleValue === null) return true;

    const selectedValue = normalizeSelectionValue(selection[field]);
    return selectedValue !== null && selectedValue === ruleValue;
  });
}

function normalizeDocumentName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function selectBestDocumentRule<T extends DocumentRuleProfile>(
  rules: T[],
  selection: DocumentRuleSelection,
): T | null {
  const ranked = rules.flatMap(rule => {
    let exactMatches = 0;
    let unrequestedSpecificity = 0;

    for (const field of PROFILE_FIELDS) {
      const selectedValue = normalizeSelectionValue(selection[field]);
      const ruleValue = normalizeRuleValue(rule[field]);

      // Boş kullanıcı seçimi alanı kısıtlamaz. Seçim yapıldığında hem tam
      // eşleşen özel kural hem de null genel fallback geçerlidir.
      if (selectedValue === null) {
        if (ruleValue !== null) unrequestedSpecificity += 1;
        continue;
      }
      if (ruleValue === null) continue;
      if (ruleValue !== selectedValue) return [];
      exactMatches += 1;
    }

    return [{ rule, exactMatches, unrequestedSpecificity }];
  });

  ranked.sort((left, right) =>
    right.exactMatches - left.exactMatches
    || left.unrequestedSpecificity - right.unrequestedSpecificity
    || left.rule.created_at.localeCompare(right.rule.created_at)
    || left.rule.id.localeCompare(right.rule.id),
  );

  return ranked[0]?.rule ?? null;
}

/**
 * Returns the complete rule chain for a profile: the general rule first,
 * followed by every explicitly matching profile overlay. When a legacy
 * catalog has no general rule, the old single-rule matcher remains available
 * as a deterministic fallback so an empty dropdown never removes the only
 * document list.
 */
export function selectMatchingDocumentRules<T extends DocumentRuleProfile>(
  rules: T[],
  selection: DocumentRuleSelection,
): T[] {
  const matching = rules.filter(rule => isExplicitProfileMatch(rule, selection));
  if (matching.length > 0) return matching.sort(compareRules);

  const fallback = selectBestDocumentRule(rules, selection);
  return fallback ? [fallback] : [];
}

/**
 * Merges the general document list and profile overlays without duplicating
 * documents. Later (more specific) rules may improve the description or
 * category, while a required document can never become optional.
 */
export function resolveDocumentRules<T extends DocumentRuleWithDocuments>(
  rules: T[],
  selection: DocumentRuleSelection,
): DocumentRuleResolution<T> {
  const matchedRules = selectMatchingDocumentRules(rules, selection);
  const merged = new Map<string, DocumentRuleEntry>();

  for (const rule of matchedRules) {
    for (const document of rule.parsedDocuments) {
      const name = document.name.trim().replace(/\s+/g, " ");
      if (!name) continue;

      const key = normalizeDocumentName(name);
      const current = merged.get(key);
      if (!current) {
        merged.set(key, { ...document, name });
        continue;
      }

      const category = document.category?.trim() || current.category;
      const description = document.description?.trim() || current.description;
      merged.set(key, {
        ...current,
        required: current.required || document.required,
        ...(category ? { category } : {}),
        ...(description ? { description } : {}),
      });
    }
  }

  return { rules: matchedRules, documents: [...merged.values()] };
}
