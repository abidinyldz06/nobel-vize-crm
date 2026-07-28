-- Faz 4.1.1: mükerrer müşteri koruması, evrak kuralı eşleştirme
-- tutarlılığı ve doğrulanmış ALPER ORS kayıt birleştirmesi.

BEGIN;

ALTER FUNCTION public.create_customer_application_v1(JSONB)
  RENAME TO create_customer_application_v1_core;

REVOKE ALL ON FUNCTION public.create_customer_application_v1_core(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_application_v1_core(JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_customer_application_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT := COALESCE(auth.role(), '');
  caller_staff_id UUID := public.current_staff_id();
  existing_customer_id UUID;
  allow_duplicate_customer BOOLEAN;
  v_country_id UUID;
  v_visa_type TEXT;
  v_rule_id UUID;
  v_travel_method TEXT;
  v_accommodation TEXT;
  v_occupation TEXT;
  v_with_children BOOLEAN;
  v_nationality TEXT;
  v_phone_key TEXT;
  v_email_key TEXT;
  v_passport_key TEXT;
  v_lock_key TEXT;
  v_payload JSONB;
  v_result JSONB;
  v_application_id UUID;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload_object_required' USING ERRCODE = '22023';
  END IF;
  IF caller_role <> 'service_role' AND caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  existing_customer_id := NULLIF(p_payload->>'customer_id', '')::UUID;
  allow_duplicate_customer :=
    COALESCE(NULLIF(p_payload->>'allow_duplicate_customer', '')::BOOLEAN, false);

  v_phone_key := NULLIF(regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g'), '');
  v_email_key := NULLIF(lower(trim(COALESCE(p_payload->>'email', ''))), '');
  v_passport_key := NULLIF(
    upper(regexp_replace(COALESCE(p_payload->>'passport_no', ''), '\s+', '', 'g')),
    ''
  );

  IF existing_customer_id IS NULL AND NOT allow_duplicate_customer
    AND (v_phone_key IS NOT NULL OR v_email_key IS NOT NULL OR v_passport_key IS NOT NULL) THEN
    v_lock_key := concat_ws('|', v_phone_key, v_email_key, v_passport_key);
    PERFORM pg_advisory_xact_lock(hashtextextended('customer-duplicate:' || v_lock_key, 0));

    IF EXISTS (
      SELECT 1
      FROM public.customers AS customer
      WHERE customer.is_deleted = false
        AND (
          (v_phone_key IS NOT NULL
            AND regexp_replace(COALESCE(customer.phone, ''), '[^0-9]', '', 'g') = v_phone_key)
          OR (v_email_key IS NOT NULL AND lower(trim(COALESCE(customer.email, ''))) = v_email_key)
          OR (v_passport_key IS NOT NULL
            AND upper(regexp_replace(COALESCE(customer.passport_no, ''), '\s+', '', 'g')) = v_passport_key)
        )
    ) THEN
      RAISE EXCEPTION 'possible_duplicate_customer' USING ERRCODE = '23505';
    END IF;
  END IF;

  v_visa_type := CASE
    WHEN COALESCE(NULLIF(trim(p_payload->>'visa_type'), ''), 'turistik') = 'turist'
      THEN 'turistik'
    ELSE COALESCE(NULLIF(trim(p_payload->>'visa_type'), ''), 'turistik')
  END;
  v_travel_method := NULLIF(p_payload->>'travel_method', '');
  v_accommodation := NULLIF(p_payload->>'accommodation', '');
  v_occupation := NULLIF(p_payload->>'occupation', '');
  v_with_children := NULLIF(p_payload->>'with_children', '')::BOOLEAN;
  v_nationality := NULLIF(p_payload->>'nationality', '');
  v_country_id := NULLIF(p_payload->>'country_id', '')::UUID;

  IF v_country_id IS NULL AND NULLIF(trim(p_payload->>'country_name'), '') IS NOT NULL THEN
    SELECT country.id
    INTO v_country_id
    FROM public.countries AS country
    WHERE lower(country.name) = lower(trim(p_payload->>'country_name'))
      AND country.active = true
    ORDER BY country.created_at, country.id
    LIMIT 1;
  END IF;

  v_rule_id := NULLIF(p_payload->>'matched_rule_id', '')::UUID;
  IF v_country_id IS NOT NULL AND v_rule_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.country_visa_rules AS rule
      WHERE rule.id = v_rule_id
        AND rule.country_id = v_country_id
        AND rule.visa_category = v_visa_type
        AND (v_travel_method IS NULL OR rule.travel_method IS NULL OR rule.travel_method = v_travel_method)
        AND (v_accommodation IS NULL OR rule.accommodation IS NULL OR rule.accommodation = v_accommodation)
        AND (v_occupation IS NULL OR rule.occupation IS NULL OR rule.occupation = v_occupation)
        AND (v_with_children IS NULL OR rule.with_children IS NULL OR rule.with_children = v_with_children)
        AND (v_nationality IS NULL OR rule.nationality IS NULL OR rule.nationality = v_nationality)
    ) THEN
      RAISE EXCEPTION 'matched_rule_not_valid_for_application' USING ERRCODE = '23503';
    END IF;
  ELSIF v_country_id IS NOT NULL THEN
    SELECT rule.id
    INTO v_rule_id
    FROM public.country_visa_rules AS rule
    WHERE rule.country_id = v_country_id
      AND rule.visa_category = v_visa_type
      AND (v_travel_method IS NULL OR rule.travel_method IS NULL OR rule.travel_method = v_travel_method)
      AND (v_accommodation IS NULL OR rule.accommodation IS NULL OR rule.accommodation = v_accommodation)
      AND (v_occupation IS NULL OR rule.occupation IS NULL OR rule.occupation = v_occupation)
      AND (v_with_children IS NULL OR rule.with_children IS NULL OR rule.with_children = v_with_children)
      AND (v_nationality IS NULL OR rule.nationality IS NULL OR rule.nationality = v_nationality)
    ORDER BY
      (
        COALESCE(v_travel_method IS NOT NULL AND rule.travel_method = v_travel_method, false)::INTEGER
        + COALESCE(v_accommodation IS NOT NULL AND rule.accommodation = v_accommodation, false)::INTEGER
        + COALESCE(v_occupation IS NOT NULL AND rule.occupation = v_occupation, false)::INTEGER
        + COALESCE(v_with_children IS NOT NULL AND rule.with_children = v_with_children, false)::INTEGER
        + COALESCE(v_nationality IS NOT NULL AND rule.nationality = v_nationality, false)::INTEGER
      ) DESC,
      (
        (v_travel_method IS NULL AND rule.travel_method IS NOT NULL)::INTEGER
        + (v_accommodation IS NULL AND rule.accommodation IS NOT NULL)::INTEGER
        + (v_occupation IS NULL AND rule.occupation IS NOT NULL)::INTEGER
        + (v_with_children IS NULL AND rule.with_children IS NOT NULL)::INTEGER
        + (v_nationality IS NULL AND rule.nationality IS NOT NULL)::INTEGER
      ) ASC,
      rule.created_at,
      rule.id
    LIMIT 1;
  END IF;

  v_payload := CASE
    WHEN v_rule_id IS NULL THEN p_payload - 'matched_rule_id'
    ELSE jsonb_set(p_payload, '{matched_rule_id}', to_jsonb(v_rule_id::TEXT), true)
  END;

  v_result := public.create_customer_application_v1_core(v_payload);
  v_application_id := NULLIF(v_result->>'application_id', '')::UUID;

  IF v_application_id IS NOT NULL THEN
    UPDATE public.applications
    SET
      country_id = v_country_id,
      travel_method = v_travel_method,
      accommodation = v_accommodation,
      occupation = v_occupation,
      with_children = v_with_children,
      nationality = v_nationality
    WHERE id = v_application_id;
  END IF;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.create_customer_application_v1(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_application_v1(JSONB)
  TO authenticated, service_role;

-- Production'da doğrulanan iki ALPER ORS kaydını veri kaybetmeden birleştirir.
-- Kaynak kayıt arşivlenir; ilişkili tüm kayıtlar kanonik müşteriye taşınır.
DO $$
DECLARE
  source_customer_id CONSTANT UUID := '36d2e790-6348-4541-b85a-8d04e50a676e';
  target_customer_id CONSTANT UUID := '618078b5-a75c-4adc-a8ea-e566e1098f7f';
  source_customer public.customers%ROWTYPE;
  target_customer public.customers%ROWTYPE;
BEGIN
  SELECT * INTO source_customer
  FROM public.customers
  WHERE id = source_customer_id
  FOR UPDATE;

  SELECT * INTO target_customer
  FROM public.customers
  WHERE id = target_customer_id
  FOR UPDATE;

  IF source_customer.id IS NULL OR target_customer.id IS NULL OR source_customer.is_deleted THEN
    RETURN;
  END IF;

  IF upper(trim(source_customer.first_name || ' ' || source_customer.last_name)) <> 'ALPER ORS'
    OR upper(trim(target_customer.first_name || ' ' || target_customer.last_name)) <> 'ALPER ORS'
    OR regexp_replace(COALESCE(source_customer.phone, ''), '[^0-9]', '', 'g')
      <> regexp_replace(COALESCE(target_customer.phone, ''), '[^0-9]', '', 'g')
    OR regexp_replace(COALESCE(source_customer.phone, ''), '[^0-9]', '', 'g') = '' THEN
    RAISE EXCEPTION 'verified_duplicate_customer_identity_mismatch';
  END IF;

  INSERT INTO public.customer_tags (customer_id, tag_id, created_at, created_by)
  SELECT target_customer_id, tag_id, created_at, created_by
  FROM public.customer_tags
  WHERE customer_id = source_customer_id
  ON CONFLICT (customer_id, tag_id) DO NOTHING;
  DELETE FROM public.customer_tags WHERE customer_id = source_customer_id;

  UPDATE public.applications SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.activity_log SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.communications SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.visa_history SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.family_members SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.tasks SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.notifications SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.customer_privacy_notices SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.customer_consents SET customer_id = target_customer_id WHERE customer_id = source_customer_id;
  UPDATE public.data_subject_requests SET customer_id = target_customer_id WHERE customer_id = source_customer_id;

  UPDATE public.customers
  SET
    is_deleted = true,
    deleted_at = now(),
    portal_access_enabled = false,
    portal_token = gen_random_uuid()::TEXT,
    portal_token_expires_at = now(),
    notes = concat_ws(
      E'\n',
      NULLIF(notes, ''),
      'Mükerrer kayıt olarak ' || target_customer_id::TEXT || ' numaralı müşteriye birleştirildi.'
    ),
    updated_at = now()
  WHERE id = source_customer_id;

  INSERT INTO public.activity_log (
    customer_id,
    action,
    performed_by,
    type
  ) VALUES (
    target_customer_id,
    'Mükerrer müşteri kaydı birleştirildi; ilişkili kayıtlar korundu.',
    'Sistem',
    'customer'
  );
END
$$;

COMMIT;
