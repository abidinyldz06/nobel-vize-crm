-- Faz 1: musteri + basvuru + evrak + not + log yazimlarini tek transaction
-- icinde yapan RPC ve atomik durum degisikligi.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_customer_application_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT := COALESCE(auth.role(), '');
  caller_staff_id UUID := public.current_staff_id();
  caller_is_admin BOOLEAN := public.is_admin();
  target_staff_id UUID;
  existing_customer_id UUID;
  v_customer_id UUID;
  v_country_id UUID;
  v_country_name TEXT;
  v_application_id UUID;
  v_rule_id UUID;
  v_rule_documents JSONB := '[]'::JSONB;
  actor_name TEXT := 'Sistem';
  v_visa_type TEXT;
  v_consulate_fee NUMERIC;
  v_service_fee NUMERIC;
  base_service_fee NUMERIC := 0;
  v_consultant_note TEXT;
  v_activity_action TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_document JSONB;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload_object_required' USING ERRCODE = '22023';
  END IF;

  IF caller_role <> 'service_role' AND caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  v_first_name := NULLIF(trim(p_payload->>'first_name'), '');
  v_last_name := NULLIF(trim(p_payload->>'last_name'), '');
  v_phone := NULLIF(trim(p_payload->>'phone'), '');
  v_email := NULLIF(lower(trim(p_payload->>'email')), '');
  v_consultant_note := NULLIF(trim(p_payload->>'consultant_note'), '');
  v_activity_action := NULLIF(trim(p_payload->>'activity_action'), '');
  v_visa_type := CASE
    WHEN COALESCE(NULLIF(trim(p_payload->>'visa_type'), ''), 'turistik') = 'turist' THEN 'turistik'
    ELSE COALESCE(NULLIF(trim(p_payload->>'visa_type'), ''), 'turistik')
  END;

  IF v_first_name IS NULL OR v_last_name IS NULL THEN
    RAISE EXCEPTION 'first_and_last_name_required' USING ERRCODE = '22023';
  END IF;
  IF length(v_first_name) > 100 OR length(v_last_name) > 100 OR length(COALESCE(v_phone, '')) > 30 OR length(COALESCE(v_email, '')) > 254 THEN
    RAISE EXCEPTION 'customer_field_too_long' USING ERRCODE = '22001';
  END IF;

  existing_customer_id := NULLIF(p_payload->>'customer_id', '')::UUID;
  target_staff_id := NULLIF(p_payload->>'assigned_staff_id', '')::UUID;

  IF caller_role <> 'service_role' AND NOT caller_is_admin THEN
    target_staff_id := caller_staff_id;
  ELSIF target_staff_id IS NULL AND caller_staff_id IS NOT NULL THEN
    target_staff_id := caller_staff_id;
  ELSIF target_staff_id IS NULL AND caller_role = 'service_role' THEN
    SELECT staff.id
    INTO target_staff_id
    FROM public.staff AS staff
    LEFT JOIN public.customers AS customer ON customer.assigned_staff_id = staff.id
    WHERE staff.is_active = true
    GROUP BY staff.id
    ORDER BY count(customer.id), staff.created_at
    LIMIT 1;
  END IF;

  IF target_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff AS staff WHERE staff.id = target_staff_id AND staff.is_active = true
  ) THEN
    RAISE EXCEPTION 'assigned_staff_not_active' USING ERRCODE = '23503';
  END IF;

  IF caller_staff_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
    INTO actor_name
    FROM public.staff AS staff
    WHERE staff.id = caller_staff_id;
  ELSIF target_staff_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
    INTO actor_name
    FROM public.staff AS staff
    WHERE staff.id = target_staff_id;
  END IF;

  IF existing_customer_id IS NOT NULL THEN
    SELECT id
    INTO v_customer_id
    FROM public.customers
    WHERE id = existing_customer_id;

    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'customer_not_found_or_not_accessible' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.customers
    SET assigned_staff_id = COALESCE(public.customers.assigned_staff_id, target_staff_id)
    WHERE public.customers.id = v_customer_id;
  ELSE
    INSERT INTO public.customers (
      first_name,
      last_name,
      phone,
      email,
      profile_score,
      passport_no,
      passport_expiry,
      passport_issuing_country,
      notes,
      assigned_staff_id
    ) VALUES (
      v_first_name,
      v_last_name,
      v_phone,
      v_email,
      COALESCE(NULLIF(p_payload->>'profile_score', '')::INTEGER, 30),
      NULLIF(trim(p_payload->>'passport_no'), ''),
      NULLIF(p_payload->>'passport_expiry', '')::DATE,
      COALESCE(NULLIF(trim(p_payload->>'passport_issuing_country'), ''), 'Türkiye'),
      NULLIF(trim(p_payload->>'customer_notes'), ''),
      target_staff_id
    )
    RETURNING id INTO v_customer_id;
  END IF;

  v_country_id := NULLIF(p_payload->>'country_id', '')::UUID;
  IF v_country_id IS NULL AND NULLIF(trim(p_payload->>'country_name'), '') IS NOT NULL THEN
    SELECT country.id
    INTO v_country_id
    FROM public.countries AS country
    WHERE lower(country.name) = lower(trim(p_payload->>'country_name'))
      AND country.active = true
    ORDER BY country.created_at
    LIMIT 1;
  END IF;

  IF v_country_id IS NULL AND NULLIF(trim(p_payload->>'country_name'), '') IS NOT NULL THEN
    RAISE EXCEPTION 'country_not_found_or_inactive' USING ERRCODE = '23503';
  END IF;

  IF v_country_id IS NOT NULL THEN
    SELECT country.name, COALESCE(country.base_fee_service, 0)
    INTO v_country_name, base_service_fee
    FROM public.countries AS country
    WHERE country.id = v_country_id AND country.active = true;

    IF v_country_name IS NULL THEN
      RAISE EXCEPTION 'country_not_found_or_inactive' USING ERRCODE = '23503';
    END IF;

    IF COALESCE((p_payload->>'reject_duplicate_application')::BOOLEAN, false)
      AND EXISTS (
        SELECT 1
        FROM public.applications AS application
        WHERE application.customer_id = v_customer_id
          AND lower(application.country) = lower(v_country_name)
          AND application.visa_type = v_visa_type
      ) THEN
      RAISE EXCEPTION 'duplicate_customer_application' USING ERRCODE = '23505';
    END IF;

    v_rule_id := NULLIF(p_payload->>'matched_rule_id', '')::UUID;
    IF v_rule_id IS NOT NULL THEN
      SELECT rule.documents
      INTO v_rule_documents
      FROM public.country_visa_rules AS rule
      WHERE rule.id = v_rule_id
        AND rule.country_id = v_country_id
        AND rule.visa_category = v_visa_type;

      IF v_rule_documents IS NULL THEN
        RAISE EXCEPTION 'matched_rule_not_valid_for_application' USING ERRCODE = '23503';
      END IF;
    ELSE
      SELECT rule.id, rule.documents
      INTO v_rule_id, v_rule_documents
      FROM public.country_visa_rules AS rule
      WHERE rule.country_id = v_country_id
        AND rule.visa_category = v_visa_type
        AND (rule.travel_method IS NULL OR rule.travel_method = NULLIF(p_payload->>'travel_method', ''))
        AND (rule.accommodation IS NULL OR rule.accommodation = NULLIF(p_payload->>'accommodation', ''))
        AND (rule.occupation IS NULL OR rule.occupation = NULLIF(p_payload->>'occupation', ''))
        AND (rule.with_children IS NULL OR rule.with_children = NULLIF(p_payload->>'with_children', '')::BOOLEAN)
        AND (rule.nationality IS NULL OR rule.nationality = NULLIF(p_payload->>'nationality', ''))
      ORDER BY
        ((rule.travel_method IS NOT NULL)::INTEGER
        + (rule.accommodation IS NOT NULL)::INTEGER
        + (rule.occupation IS NOT NULL)::INTEGER
        + (rule.with_children IS NOT NULL)::INTEGER
        + (rule.nationality IS NOT NULL)::INTEGER) DESC,
        rule.created_at
      LIMIT 1;
    END IF;

    v_rule_documents := COALESCE(v_rule_documents, '[]'::JSONB);
    IF jsonb_typeof(v_rule_documents) <> 'array' THEN
      RAISE EXCEPTION 'rule_documents_must_be_array' USING ERRCODE = '22023';
    END IF;

    v_consulate_fee := COALESCE(NULLIF(p_payload->>'consulate_fee', '')::NUMERIC, 0);
    v_service_fee := COALESCE(NULLIF(p_payload->>'service_fee', '')::NUMERIC, base_service_fee);

    IF v_consulate_fee < 0 OR v_service_fee < 0 THEN
      RAISE EXCEPTION 'fees_must_be_nonnegative' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.applications (
      customer_id,
      country,
      visa_type,
      status,
      consulate_fee,
      service_fee,
      total_fee,
      assigned_staff_id
    ) VALUES (
      v_customer_id,
      v_country_name,
      v_visa_type,
      'profil_analizi',
      v_consulate_fee,
      v_service_fee,
      v_consulate_fee + v_service_fee,
      target_staff_id
    )
    RETURNING id INTO v_application_id;

    FOR v_document IN SELECT value FROM jsonb_array_elements(v_rule_documents)
    LOOP
      IF NULLIF(trim(v_document->>'name'), '') IS NOT NULL THEN
        INSERT INTO public.documents (
          application_id,
          document_type,
          category,
          is_required,
          description,
          status
        ) VALUES (
          v_application_id,
          trim(v_document->>'name'),
          COALESCE(NULLIF(v_document->>'category', ''), 'diger'),
          COALESCE((v_document->>'required')::BOOLEAN, true),
          NULLIF(v_document->>'description', ''),
          'bekleniyor'
        );
      END IF;
    END LOOP;

    IF v_consultant_note IS NOT NULL THEN
      INSERT INTO public.notes (application_id, content, created_by, author)
      VALUES (v_application_id, v_consultant_note, COALESCE(caller_staff_id, target_staff_id), actor_name);
    END IF;
  END IF;

  INSERT INTO public.activity_log (
    customer_id,
    application_id,
    action,
    performed_by,
    performed_by_staff_id,
    type
  ) VALUES (
    v_customer_id,
    v_application_id,
    COALESCE(
      v_activity_action,
      CASE
        WHEN v_application_id IS NOT NULL THEN 'Yeni başvuru oluşturuldu: ' || v_country_name || ' — ' || v_visa_type || ' vizesi'
        ELSE 'Yeni müşteri oluşturuldu'
      END
    ),
    actor_name,
    COALESCE(caller_staff_id, target_staff_id),
    'customer'
  );

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'application_id', v_application_id,
    'country_id', v_country_id,
    'matched_rule_id', v_rule_id,
    'existing_customer', existing_customer_id IS NOT NULL
  );
END
$$;

CREATE OR REPLACE FUNCTION public.update_application_status_v1(
  p_application_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  v_customer_id UUID;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN (
    'profil_analizi', 'evrak_bekleniyor', 'randevu_bekleniyor',
    'randevu_alindi', 'evrak_hazirlaniyor', 'basvuru_yapildi',
    'onaylandi', 'reddedildi', 'itiraz', 'kapandi'
  ) THEN
    RAISE EXCEPTION 'invalid_application_status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'reddedildi' AND NULLIF(trim(p_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  UPDATE public.applications
  SET
    status = p_status,
    rejection_reason = CASE WHEN p_status = 'reddedildi' THEN NULLIF(trim(p_rejection_reason), '') ELSE NULL END
  WHERE id = p_application_id
  RETURNING public.applications.customer_id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.activity_log (
    application_id,
    customer_id,
    action,
    performed_by,
    performed_by_staff_id,
    type
  ) VALUES (
    p_application_id,
    v_customer_id,
    COALESCE(NULLIF(trim(p_action), ''), 'Başvuru durumu güncellendi: ' || p_status),
    actor_name,
    actor_staff_id,
    'status'
  );

  RETURN jsonb_build_object(
    'application_id', p_application_id,
    'customer_id', v_customer_id,
    'status', p_status
  );
END
$$;

REVOKE ALL ON FUNCTION public.create_customer_application_v1(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_application_status_v1(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_application_v1(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_application_status_v1(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
