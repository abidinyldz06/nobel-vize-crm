-- Faz 5.5.1: ülke/kategori genel evrak listesini profil ekleriyle birleştirir.
-- Tek kural seçimi yerine genel kural + açıkça eşleşen tüm profil kuralları
-- uygulanır; aynı adlı evraklar zorunluluk bilgisi kaybolmadan tekilleştirilir.

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS matched_rule_ids UUID[] DEFAULT ARRAY[]::UUID[];

UPDATE public.applications
SET matched_rule_ids = ARRAY[]::UUID[]
WHERE matched_rule_ids IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_country_visa_documents_v1(
  p_country_id UUID,
  p_visa_category TEXT,
  p_travel_method TEXT DEFAULT NULL,
  p_accommodation TEXT DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_with_children BOOLEAN DEFAULT NULL,
  p_nationality TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_rule_ids UUID[] := ARRAY[]::UUID[];
  v_documents JSONB := '[]'::JSONB;
  v_rule RECORD;
  v_document JSONB;
  v_existing JSONB;
  v_merged JSONB;
  v_document_name TEXT;
  v_document_key TEXT;
  v_document_index INTEGER;
  v_required BOOLEAN;
BEGIN
  IF p_country_id IS NULL OR NULLIF(btrim(COALESCE(p_visa_category, '')), '') IS NULL THEN
    RETURN jsonb_build_object(
      'primary_rule_id', NULL,
      'rule_ids', '[]'::JSONB,
      'documents', '[]'::JSONB
    );
  END IF;

  -- Genel kural ile yalnızca açıkça seçilmiş profile uyan ek kuralları alır.
  SELECT COALESCE(
    array_agg(
      rule.id
      ORDER BY
        ((rule.travel_method IS NOT NULL)::INTEGER
        + (rule.accommodation IS NOT NULL)::INTEGER
        + (rule.occupation IS NOT NULL)::INTEGER
        + (rule.with_children IS NOT NULL)::INTEGER
        + (rule.nationality IS NOT NULL)::INTEGER),
        rule.created_at,
        rule.id
    ),
    ARRAY[]::UUID[]
  )
  INTO v_rule_ids
  FROM public.country_visa_rules AS rule
  WHERE rule.country_id = p_country_id
    AND rule.visa_category = p_visa_category
    AND (rule.travel_method IS NULL
      OR (p_travel_method IS NOT NULL AND rule.travel_method = p_travel_method))
    AND (rule.accommodation IS NULL
      OR (p_accommodation IS NOT NULL AND rule.accommodation = p_accommodation))
    AND (rule.occupation IS NULL
      OR (p_occupation IS NOT NULL AND rule.occupation = p_occupation))
    AND (rule.with_children IS NULL
      OR (p_with_children IS NOT NULL AND rule.with_children = p_with_children))
    AND (rule.nationality IS NULL
      OR (p_nationality IS NOT NULL AND rule.nationality = p_nationality));

  -- Eski kataloglarda genel kural yoksa tek listeyi kaybetmemek için önceki
  -- deterministik seçim davranışını güvenli fallback olarak korur.
  IF cardinality(v_rule_ids) = 0 THEN
    SELECT ARRAY[rule.id]
    INTO v_rule_ids
    FROM public.country_visa_rules AS rule
    WHERE rule.country_id = p_country_id
      AND rule.visa_category = p_visa_category
      AND (p_travel_method IS NULL OR rule.travel_method IS NULL OR rule.travel_method = p_travel_method)
      AND (p_accommodation IS NULL OR rule.accommodation IS NULL OR rule.accommodation = p_accommodation)
      AND (p_occupation IS NULL OR rule.occupation IS NULL OR rule.occupation = p_occupation)
      AND (p_with_children IS NULL OR rule.with_children IS NULL OR rule.with_children = p_with_children)
      AND (p_nationality IS NULL OR rule.nationality IS NULL OR rule.nationality = p_nationality)
    ORDER BY
      (
        COALESCE(p_travel_method IS NOT NULL AND rule.travel_method = p_travel_method, false)::INTEGER
        + COALESCE(p_accommodation IS NOT NULL AND rule.accommodation = p_accommodation, false)::INTEGER
        + COALESCE(p_occupation IS NOT NULL AND rule.occupation = p_occupation, false)::INTEGER
        + COALESCE(p_with_children IS NOT NULL AND rule.with_children = p_with_children, false)::INTEGER
        + COALESCE(p_nationality IS NOT NULL AND rule.nationality = p_nationality, false)::INTEGER
      ) DESC,
      (
        (p_travel_method IS NULL AND rule.travel_method IS NOT NULL)::INTEGER
        + (p_accommodation IS NULL AND rule.accommodation IS NOT NULL)::INTEGER
        + (p_occupation IS NULL AND rule.occupation IS NOT NULL)::INTEGER
        + (p_with_children IS NULL AND rule.with_children IS NOT NULL)::INTEGER
        + (p_nationality IS NULL AND rule.nationality IS NOT NULL)::INTEGER
      ) ASC,
      rule.created_at,
      rule.id
    LIMIT 1;
  END IF;

  v_rule_ids := COALESCE(v_rule_ids, ARRAY[]::UUID[]);

  FOR v_rule IN
    SELECT rule.*
    FROM public.country_visa_rules AS rule
    WHERE rule.id = ANY(v_rule_ids)
    ORDER BY array_position(v_rule_ids, rule.id)
  LOOP
    IF jsonb_typeof(v_rule.documents) <> 'array' THEN
      RAISE EXCEPTION 'rule_documents_must_be_array' USING ERRCODE = '22023';
    END IF;

    FOR v_document IN SELECT value FROM jsonb_array_elements(v_rule.documents)
    LOOP
      v_document_name := NULLIF(regexp_replace(btrim(COALESCE(v_document->>'name', '')), '\s+', ' ', 'g'), '');
      IF v_document_name IS NULL THEN
        CONTINUE;
      END IF;

      v_document_key := lower(v_document_name);
      v_required := COALESCE((v_document->>'required')::BOOLEAN, true);
      v_document := jsonb_set(v_document, '{name}', to_jsonb(v_document_name), true);
      v_document := jsonb_set(v_document, '{required}', to_jsonb(v_required), true);

      SELECT (item.ordinality - 1)::INTEGER
      INTO v_document_index
      FROM jsonb_array_elements(v_documents) WITH ORDINALITY AS item(value, ordinality)
      WHERE lower(regexp_replace(btrim(COALESCE(item.value->>'name', '')), '\s+', ' ', 'g')) = v_document_key
      LIMIT 1;

      IF v_document_index IS NULL THEN
        v_documents := v_documents || jsonb_build_array(v_document);
        CONTINUE;
      END IF;

      v_existing := v_documents->v_document_index;
      v_merged := jsonb_set(
        v_existing,
        '{required}',
        to_jsonb(COALESCE((v_existing->>'required')::BOOLEAN, true) OR v_required),
        true
      );

      IF NULLIF(btrim(COALESCE(v_document->>'category', '')), '') IS NOT NULL THEN
        v_merged := jsonb_set(v_merged, '{category}', v_document->'category', true);
      END IF;
      IF NULLIF(btrim(COALESCE(v_document->>'description', '')), '') IS NOT NULL THEN
        v_merged := jsonb_set(v_merged, '{description}', v_document->'description', true);
      END IF;

      v_documents := jsonb_set(
        v_documents,
        ARRAY[v_document_index::TEXT],
        v_merged,
        false
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'primary_rule_id', v_rule_ids[1],
    'rule_ids', to_jsonb(v_rule_ids),
    'documents', v_documents
  );
END
$$;

REVOKE ALL ON FUNCTION public.resolve_country_visa_documents_v1(
  UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_country_visa_documents_v1(
  UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) TO authenticated, service_role;

ALTER FUNCTION public.create_customer_application_v1(JSONB)
  RENAME TO create_customer_application_v1_single_rule_core;

REVOKE ALL ON FUNCTION public.create_customer_application_v1_single_rule_core(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_application_v1_single_rule_core(JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_customer_application_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
  v_application_id UUID;
  v_application public.applications%ROWTYPE;
  v_rule_resolution JSONB;
  v_rule_ids UUID[] := ARRAY[]::UUID[];
  v_document JSONB;
BEGIN
  -- Kural kimliği istemciden güven kaynağı olarak alınmaz. İç iş akışı ilk
  -- kaydı oluşturur; ardından sunucu profili yeniden çözerek birleşik ve
  -- tekilleştirilmiş evrak anlık görüntüsünü yazar.
  v_result := public.create_customer_application_v1_single_rule_core(
    p_payload - 'matched_rule_id' - 'matched_rule_ids'
  );

  v_application_id := NULLIF(v_result->>'application_id', '')::UUID;

  IF v_application_id IS NULL THEN
    RETURN v_result || jsonb_build_object('matched_rule_ids', '[]'::JSONB);
  END IF;

  SELECT * INTO v_application
  FROM public.applications
  WHERE id = v_application_id;

  IF v_application.country_id IS NULL THEN
    RETURN v_result || jsonb_build_object('matched_rule_ids', '[]'::JSONB);
  END IF;

  v_rule_resolution := public.resolve_country_visa_documents_v1(
    v_application.country_id,
    v_application.visa_type,
    v_application.travel_method,
    v_application.accommodation,
    v_application.occupation,
    v_application.with_children,
    v_application.nationality
  );

  SELECT COALESCE(array_agg(value::UUID), ARRAY[]::UUID[])
  INTO v_rule_ids
  FROM jsonb_array_elements_text(v_rule_resolution->'rule_ids');

  DELETE FROM public.documents
  WHERE application_id = v_application_id;

  FOR v_document IN SELECT value FROM jsonb_array_elements(v_rule_resolution->'documents')
  LOOP
    INSERT INTO public.documents (
      application_id, document_type, category, is_required, description, status
    ) VALUES (
      v_application_id,
      btrim(v_document->>'name'),
      COALESCE(NULLIF(v_document->>'category', ''), 'diger'),
      COALESCE((v_document->>'required')::BOOLEAN, true),
      NULLIF(v_document->>'description', ''),
      'bekleniyor'
    );
  END LOOP;

  UPDATE public.applications
  SET matched_rule_ids = v_rule_ids
  WHERE id = v_application_id;

  RETURN v_result || jsonb_build_object(
    'matched_rule_id', v_rule_resolution->'primary_rule_id',
    'matched_rule_ids', v_rule_resolution->'rule_ids'
  );
END
$$;

REVOKE ALL ON FUNCTION public.create_customer_application_v1(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_application_v1(JSONB)
  TO authenticated, service_role;

ALTER FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB)
  RENAME TO update_customer_application_v1_profile_core;

REVOKE ALL ON FUNCTION public.update_customer_application_v1_profile_core(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_application_v1_profile_core(UUID, UUID, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_customer_application_v1(
  p_customer_id UUID,
  p_application_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
  v_application public.applications%ROWTYPE;
  v_rule_resolution JSONB;
  v_rule_ids UUID[] := ARRAY[]::UUID[];
  v_document JSONB;
  v_added_count INTEGER := 0;
BEGIN
  v_result := public.update_customer_application_v1_profile_core(
    p_customer_id,
    p_application_id,
    p_payload
  );

  SELECT * INTO v_application
  FROM public.applications
  WHERE id = p_application_id AND customer_id = p_customer_id;

  v_rule_resolution := public.resolve_country_visa_documents_v1(
    v_application.country_id,
    v_application.visa_type,
    v_application.travel_method,
    v_application.accommodation,
    v_application.occupation,
    v_application.with_children,
    v_application.nationality
  );

  SELECT COALESCE(array_agg(value::UUID), ARRAY[]::UUID[])
  INTO v_rule_ids
  FROM jsonb_array_elements_text(v_rule_resolution->'rule_ids');

  FOR v_document IN SELECT value FROM jsonb_array_elements(v_rule_resolution->'documents')
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.documents AS document
      WHERE document.application_id = p_application_id
        AND lower(regexp_replace(btrim(document.document_type), '\s+', ' ', 'g'))
          = lower(regexp_replace(btrim(v_document->>'name'), '\s+', ' ', 'g'))
    ) THEN
      UPDATE public.documents AS document
      SET is_required = document.is_required OR COALESCE((v_document->>'required')::BOOLEAN, true),
          category = CASE
            WHEN document.category = 'diger'
              THEN COALESCE(NULLIF(v_document->>'category', ''), document.category)
            ELSE document.category
          END,
          description = COALESCE(document.description, NULLIF(v_document->>'description', ''))
      WHERE document.application_id = p_application_id
        AND lower(regexp_replace(btrim(document.document_type), '\s+', ' ', 'g'))
          = lower(regexp_replace(btrim(v_document->>'name'), '\s+', ' ', 'g'));
    ELSE
      INSERT INTO public.documents (
        application_id, document_type, category, is_required, description, status
      ) VALUES (
        p_application_id,
        btrim(v_document->>'name'),
        COALESCE(NULLIF(v_document->>'category', ''), 'diger'),
        COALESCE((v_document->>'required')::BOOLEAN, true),
        NULLIF(v_document->>'description', ''),
        'bekleniyor'
      );
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;

  UPDATE public.applications
  SET matched_rule_ids = v_rule_ids
  WHERE id = p_application_id;

  RETURN v_result || jsonb_build_object(
    'matched_rule_ids', v_rule_resolution->'rule_ids',
    'documents_added', v_added_count
  );
END
$$;

REVOKE ALL ON FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB)
  TO authenticated, service_role;

COMMIT;
