-- Faz 4.1: sabit kuralli ve yaniltici musteri profil skorunu kaldirir.

BEGIN;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_profile_score_valid,
  DROP COLUMN IF EXISTS profile_score;

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
  IF length(v_first_name) > 100 OR length(v_last_name) > 100
    OR length(COALESCE(v_phone, '')) > 30
    OR length(COALESCE(v_email, '')) > 254 THEN
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
    SELECT 1
    FROM public.staff AS staff
    WHERE staff.id = target_staff_id AND staff.is_active = true
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
      VALUES (
        v_application_id,
        v_consultant_note,
        COALESCE(caller_staff_id, target_staff_id),
        actor_name
      );
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
        WHEN v_application_id IS NOT NULL
          THEN 'Yeni başvuru oluşturuldu: ' || v_country_name || ' — ' || v_visa_type || ' vizesi'
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
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  actor_is_admin BOOLEAN := public.is_admin();
  v_current_status TEXT;
  v_new_status TEXT;
  v_country_id UUID;
  v_country_name TEXT;
  v_target_staff_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_financial_status TEXT;
  v_visa_type TEXT;
  v_travel_method TEXT;
  v_accommodation TEXT;
  v_occupation TEXT;
  v_nationality TEXT;
  v_rejection_reason TEXT;
  v_tag_ids UUID[];
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload_object_required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_access_customer(p_customer_id)
    OR NOT public.can_access_application(p_application_id) THEN
    RAISE EXCEPTION 'customer_or_application_not_accessible' USING ERRCODE = '42501';
  END IF;

  SELECT application.status
  INTO v_current_status
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id
  WHERE application.id = p_application_id
    AND application.customer_id = p_customer_id
    AND customer.is_deleted = false
  FOR UPDATE OF application;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'customer_application_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM customer.id
  FROM public.customers AS customer
  WHERE customer.id = p_customer_id
  FOR UPDATE;

  v_first_name := NULLIF(trim(p_payload->>'first_name'), '');
  v_last_name := NULLIF(trim(p_payload->>'last_name'), '');
  v_phone := NULLIF(trim(p_payload->>'phone'), '');
  v_email := NULLIF(lower(trim(p_payload->>'email')), '');
  v_financial_status := COALESCE(NULLIF(p_payload->>'financial_status', ''), 'orta');
  v_new_status := COALESCE(NULLIF(p_payload->>'status', ''), v_current_status);
  v_visa_type := COALESCE(NULLIF(p_payload->>'visa_type', ''), 'turistik');
  v_travel_method := NULLIF(p_payload->>'travel_method', '');
  v_accommodation := NULLIF(p_payload->>'accommodation', '');
  v_occupation := NULLIF(p_payload->>'occupation', '');
  v_nationality := NULLIF(p_payload->>'nationality', '');
  v_rejection_reason := NULLIF(trim(p_payload->>'rejection_reason'), '');
  v_country_id := NULLIF(p_payload->>'country_id', '')::UUID;
  v_target_staff_id := NULLIF(p_payload->>'assigned_staff_id', '')::UUID;

  IF v_first_name IS NULL OR v_last_name IS NULL OR v_country_id IS NULL THEN
    RAISE EXCEPTION 'name_and_country_required' USING ERRCODE = '22023';
  END IF;
  IF length(v_first_name) > 100 OR length(v_last_name) > 100
    OR length(COALESCE(v_phone, '')) > 30
    OR length(COALESCE(v_email, '')) > 254 THEN
    RAISE EXCEPTION 'customer_field_too_long' USING ERRCODE = '22001';
  END IF;
  IF v_financial_status NOT IN ('dusuk', 'orta', 'iyi', 'yuksek') THEN
    RAISE EXCEPTION 'invalid_financial_status' USING ERRCODE = '22023';
  END IF;
  IF v_visa_type NOT IN (
    'turistik', 'aile_ziyareti', 'aile_birlesimi', 'is', 'ogrenci',
    'transit', 'tedavi', 'arastirma', 'kulturel_spor', 'calisma'
  ) THEN
    RAISE EXCEPTION 'invalid_visa_type' USING ERRCODE = '22023';
  END IF;

  SELECT country.name
  INTO v_country_name
  FROM public.countries AS country
  WHERE country.id = v_country_id AND country.active = true;
  IF v_country_name IS NULL THEN
    RAISE EXCEPTION 'country_not_found_or_inactive' USING ERRCODE = '23503';
  END IF;

  IF NOT actor_is_admin OR NOT (p_payload ? 'assigned_staff_id') THEN
    SELECT customer.assigned_staff_id
    INTO v_target_staff_id
    FROM public.customers AS customer
    WHERE customer.id = p_customer_id;
  ELSIF v_target_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.staff AS staff
    WHERE staff.id = v_target_staff_id AND staff.is_active = true
  ) THEN
    RAISE EXCEPTION 'assigned_staff_not_active' USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  UPDATE public.customers
  SET first_name = v_first_name,
      last_name = v_last_name,
      phone = v_phone,
      email = v_email,
      financial_status = v_financial_status,
      monthly_income = NULLIF(p_payload->>'monthly_income', '')::NUMERIC,
      notes = NULLIF(trim(p_payload->>'notes'), ''),
      passport_no = NULLIF(trim(p_payload->>'passport_no'), ''),
      passport_expiry = NULLIF(p_payload->>'passport_expiry', '')::DATE,
      passport_issuing_country = COALESCE(
        NULLIF(trim(p_payload->>'passport_issuing_country'), ''),
        'Türkiye'
      ),
      assigned_staff_id = v_target_staff_id
  WHERE id = p_customer_id;

  UPDATE public.applications
  SET country_id = v_country_id,
      country = v_country_name,
      visa_type = v_visa_type,
      travel_method = v_travel_method,
      accommodation = v_accommodation,
      occupation = v_occupation,
      with_children = CASE
        WHEN p_payload ? 'with_children'
          AND NULLIF(p_payload->>'with_children', '') IS NOT NULL
          THEN (p_payload->>'with_children')::BOOLEAN
        ELSE NULL
      END,
      nationality = v_nationality,
      assigned_staff_id = v_target_staff_id
  WHERE id = p_application_id;

  IF v_new_status <> v_current_status THEN
    PERFORM public.update_application_status_v1(
      p_application_id,
      v_new_status,
      v_rejection_reason,
      'Başvuru durumu düzenleme ekranından güncellendi: '
        || v_current_status || ' → ' || v_new_status
    );
  END IF;

  IF p_payload ? 'tag_ids' THEN
    IF jsonb_typeof(p_payload->'tag_ids') <> 'array' THEN
      RAISE EXCEPTION 'tag_ids_array_required' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(value::UUID), ARRAY[]::UUID[])
    INTO v_tag_ids
    FROM jsonb_array_elements_text(p_payload->'tag_ids');
    PERFORM public.set_customer_tags_v1(p_customer_id, v_tag_ids);
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
    p_customer_id,
    'Müşteri ve başvuru bilgileri güncellendi',
    actor_name,
    actor_staff_id,
    'customer'
  );

  RETURN jsonb_build_object(
    'customer_id', p_customer_id,
    'application_id', p_application_id,
    'status', v_new_status,
    'country_id', v_country_id
  );
END
$$;

CREATE OR REPLACE FUNCTION public.anonymize_customer_v1(
  p_customer_id UUID,
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT;
  grace_days INTEGER;
  customer_record public.customers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT archive_grace_days
  INTO grace_days
  FROM public.privacy_settings
  WHERE id = '00000000-0000-0000-0000-000000000360';

  SELECT *
  INTO customer_record
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF customer_record.id IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT customer_record.is_deleted
    OR customer_record.deleted_at > now() - make_interval(days => grace_days) THEN
    RAISE EXCEPTION 'archive_grace_period_required' USING ERRCODE = '22023';
  END IF;
  IF customer_record.anonymized_at IS NOT NULL THEN
    RAISE EXCEPTION 'customer_already_anonymized' USING ERRCODE = '22023';
  END IF;
  IF customer_record.retention_hold_until IS NOT NULL
    AND customer_record.retention_hold_until > now() THEN
    RAISE EXCEPTION 'customer_retention_hold_active' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.data_subject_requests
    WHERE id = p_request_id
      AND customer_id = p_customer_id
      AND request_type IN ('deletion', 'anonymization')
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'approved_privacy_request_required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.documents AS document
    JOIN public.applications AS application ON application.id = document.application_id
    WHERE application.customer_id = p_customer_id
      AND document.file_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'storage_cleanup_required' USING ERRCODE = '22023';
  END IF;

  SELECT full_name
  INTO actor_name
  FROM public.staff
  WHERE id = actor_staff_id AND is_active = true;

  UPDATE public.activity_log
  SET action = '[ANONİMLEŞTİRİLDİ]',
      performed_by = COALESCE(performed_by, 'Sistem')
  WHERE customer_id = p_customer_id
    OR application_id IN (
      SELECT id FROM public.applications WHERE customer_id = p_customer_id
    );
  UPDATE public.applications
  SET rejection_reason = NULL,
      appointment_location = NULL,
      travel_method = NULL,
      accommodation = NULL,
      occupation = NULL,
      with_children = NULL,
      nationality = NULL
  WHERE customer_id = p_customer_id;
  UPDATE public.notes
  SET content = '[ANONİMLEŞTİRİLDİ]', author = 'Anonim'
  WHERE application_id IN (
    SELECT id FROM public.applications WHERE customer_id = p_customer_id
  );
  UPDATE public.payments
  SET note = NULL, method = NULL
  WHERE application_id IN (
    SELECT id FROM public.applications WHERE customer_id = p_customer_id
  );
  UPDATE public.communications
  SET subject = NULL,
      content = NULL,
      recipient = NULL,
      failure_reason = NULL
  WHERE customer_id = p_customer_id
    OR application_id IN (
      SELECT id FROM public.applications WHERE customer_id = p_customer_id
    );
  UPDATE public.visa_history SET notes = NULL WHERE customer_id = p_customer_id;
  DELETE FROM public.family_members WHERE customer_id = p_customer_id;
  DELETE FROM public.customer_tags WHERE customer_id = p_customer_id;
  UPDATE public.tasks
  SET title = 'Anonimleştirilmiş müşteri görevi',
      description = NULL,
      source_id = NULL,
      idempotency_key = NULL
  WHERE customer_id = p_customer_id;
  UPDATE public.notifications
  SET title = 'Anonimleştirilmiş müşteri bildirimi',
      message = NULL,
      href = NULL,
      idempotency_key = NULL
  WHERE customer_id = p_customer_id;
  UPDATE public.customer_privacy_notices
  SET evidence_note = NULL
  WHERE customer_id = p_customer_id;
  UPDATE public.customer_consents
  SET evidence_note = NULL
  WHERE customer_id = p_customer_id;
  UPDATE public.data_subject_requests
  SET notes = NULL
  WHERE customer_id = p_customer_id;
  UPDATE public.customers
  SET first_name = 'Anonim',
      last_name = 'Müşteri ' || left(replace(id::TEXT, '-', ''), 8),
      phone = NULL,
      email = NULL,
      passport_no = NULL,
      passport_expiry = NULL,
      passport_issuing_country = NULL,
      financial_status = NULL,
      monthly_income = NULL,
      notes = NULL,
      assigned_staff_id = NULL,
      portal_token = gen_random_uuid()::TEXT,
      portal_access_enabled = false,
      portal_token_expires_at = now(),
      retention_hold_until = NULL,
      retention_hold_reason = NULL,
      anonymized_at = now(),
      anonymized_by_staff_id = actor_staff_id
  WHERE id = p_customer_id;
  UPDATE public.data_subject_requests
  SET status = 'completed',
      completed_at = now(),
      handled_by_staff_id = actor_staff_id,
      resolution_note = 'Kontrollü anonimleştirme tamamlandı.'
  WHERE id = p_request_id;
  INSERT INTO public.activity_log (
    customer_id,
    action,
    performed_by,
    performed_by_staff_id,
    type
  ) VALUES (
    p_customer_id,
    'Müşteri kontrollü olarak anonimleştirildi — ' || actor_name,
    actor_name,
    actor_staff_id,
    'privacy'
  );

  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.create_customer_application_v1(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anonymize_customer_v1(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_application_v1(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_customer_v1(UUID, UUID) TO authenticated;

COMMIT;
