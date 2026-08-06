BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(17);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name IN ('Almanya', 'Fransa', 'İtalya')
      AND rule.visa_category IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti')
      AND rule.travel_method IS NULL
      AND rule.accommodation IS NULL
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
  ),
  12,
  'first country pack has twelve general country/category rules'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name IN ('Almanya', 'Fransa', 'İtalya')
      AND rule.visa_category IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti')
      AND (
        rule.occupation IS NOT NULL
        OR rule.with_children IS NOT NULL
        OR rule.nationality IS NOT NULL
      )
  ),
  91,
  'first country pack has ninety-one explicit profile overlays'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name = 'Almanya'
      AND rule.visa_category IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti')
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
      AND rule.sources_last_reviewed_at IS NOT NULL
  ),
  4,
  'all four Germany general lists are officially reviewed'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name = 'Fransa'
      AND rule.visa_category IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti')
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
      AND rule.sources_last_reviewed_at IS NULL
  ),
  4,
  'France exact lists remain pending Visa Assistant verification'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name = 'İtalya'
      AND rule.visa_category IN ('turistik', 'ogrenci', 'aile_ziyareti')
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
      AND rule.sources_last_reviewed_at IS NOT NULL
  ),
  3,
  'three Italy lists have direct official checklist verification'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name = 'İtalya'
      AND rule.visa_category = 'is'
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
      AND rule.sources_last_reviewed_at IS NULL
  ),
  1,
  'Italy business list stays pending a current direct checklist'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    CROSS JOIN LATERAL jsonb_array_elements(rule.sources) AS source(value)
    WHERE country.name IN ('Fransa', 'İtalya')
      AND rule.sources_last_reviewed_at IS NULL
      AND source.value ? 'checked_at'
  ),
  'pending rules do not carry misleading checked_at values'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    CROSS JOIN LATERAL jsonb_array_elements(rule.sources) AS source(value)
    WHERE country.name IN ('Almanya', 'Fransa', 'İtalya')
      AND COALESCE(source.value->>'url', '') !~ '^https://'
  ),
  'every source URL in the first country pack uses HTTPS'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name IN ('Almanya', 'Fransa', 'İtalya')
      AND rule.visa_category IN ('turistik', 'is', 'ogrenci', 'aile_ziyareti')
      AND rule.travel_method IS NULL
      AND rule.accommodation IS NULL
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
      AND jsonb_array_length(rule.documents) < 10
  ),
  'every general list contains at least ten documents'
);

SELECT ok(
  (
    SELECT rule.notes
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name = 'Almanya'
      AND rule.visa_category = 'ogrenci'
      AND rule.occupation IS NULL
      AND rule.with_children IS NULL
      AND rule.nationality IS NULL
  ) LIKE '%ulusal vize%',
  'Germany student rule warns that long-term study is a national visa flow'
);

SELECT is(
  (
    SELECT jsonb_array_length(
      public.resolve_country_visa_documents_v1(
        country.id, 'turistik', 'ucak', 'otel', 'calisan', true, 'diger'
      )->'rule_ids'
    )
    FROM public.countries AS country
    WHERE country.name = 'Almanya'
  ),
  4,
  'Germany employee with children and foreign nationality resolves four layers'
);

SELECT ok(
  (
    SELECT public.resolve_country_visa_documents_v1(
      country.id, 'turistik', 'ucak', 'otel', 'calisan', true, 'diger'
    )->'documents' @> '[{"name":"SGK İşe Giriş Bildirgesi ve Hizmet Dökümü"}]'::JSONB
    FROM public.countries AS country
    WHERE country.name = 'Almanya'
  ),
  'employee overlay contributes SGK documents'
);

SELECT ok(
  (
    SELECT public.resolve_country_visa_documents_v1(
      country.id, 'turistik', 'ucak', 'otel', 'calisan', true, 'diger'
    )->'documents' @> '[{"name":"Çocuklar İçin Muvafakatname veya Velayet Kararı"}]'::JSONB
    FROM public.countries AS country
    WHERE country.name = 'Almanya'
  ),
  'children overlay contributes consent or custody documents'
);

SELECT ok(
  (
    SELECT public.resolve_country_visa_documents_v1(
      country.id, 'turistik', 'ucak', 'otel', 'calisan', true, 'diger'
    )->'documents' @> '[{"name":"Türkiye Yasal İkamet Belgesi"}]'::JSONB
    FROM public.countries AS country
    WHERE country.name = 'Almanya'
  ),
  'foreign nationality overlay contributes Turkish residence evidence'
);

SELECT ok(
  (
    SELECT NOT EXISTS (
      SELECT 1
      FROM (
        SELECT lower(regexp_replace(btrim(document->>'name'), '\s+', ' ', 'g')) AS key
        FROM jsonb_array_elements(
          public.resolve_country_visa_documents_v1(
            country.id, 'turistik', 'ucak', 'otel', 'calisan', true, 'diger'
          )->'documents'
        ) AS document
      ) AS resolved
      GROUP BY resolved.key
      HAVING count(*) > 1
    )
    FROM public.countries AS country
    WHERE country.name = 'Almanya'
  ),
  'resolved documents are normalized and unique'
);

SELECT is(
  (
    SELECT jsonb_array_length(
      public.resolve_country_visa_documents_v1(
        country.id, 'turistik', NULL, NULL, NULL, NULL, NULL
      )->'rule_ids'
    )
    FROM public.countries AS country
    WHERE country.name = 'Fransa'
  ),
  1,
  'blank France profile resolves only the general rule'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.country_visa_rules AS rule
    JOIN public.countries AS country ON country.id = rule.country_id
    WHERE country.name = 'Almanya'
      AND rule.visa_category = 'ogrenci'
      AND rule.occupation IS NOT NULL
  ),
  1,
  'Germany short student-trip category only has the relevant student occupation overlay'
);

SELECT * FROM finish();
ROLLBACK;
