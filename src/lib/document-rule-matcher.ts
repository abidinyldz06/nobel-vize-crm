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
