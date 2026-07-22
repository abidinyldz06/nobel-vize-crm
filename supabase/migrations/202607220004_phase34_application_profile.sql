-- Faz 3.4.2: basvuru profil alanlari ve atomik musteri/basvuru duzenleme akisi.

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS country_id UUID,
  ADD COLUMN IF NOT EXISTS travel_method TEXT,
  ADD COLUMN IF NOT EXISTS accommodation TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS with_children BOOLEAN,
  ADD COLUMN IF NOT EXISTS nationality TEXT;

UPDATE public.applications AS application
SET country_id = country.id
FROM public.countries AS country
WHERE application.country_id IS NULL
  AND lower(trim(application.country)) = lower(trim(country.name));

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_country_id_fk,
  ADD CONSTRAINT applications_country_id_fk
    FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS applications_travel_method_check,
  ADD CONSTRAINT applications_travel_method_check
    CHECK (travel_method IS NULL OR travel_method IN ('ucak', 'tur_paketi', 'gemi', 'kendi_araci', 'diger')),
  DROP CONSTRAINT IF EXISTS applications_accommodation_check,
  ADD CONSTRAINT applications_accommodation_check
    CHECK (accommodation IS NULL OR accommodation IN ('otel', 'aile_arkadas', 'diger')),
  DROP CONSTRAINT IF EXISTS applications_occupation_check,
  ADD CONSTRAINT applications_occupation_check
    CHECK (occupation IS NULL OR occupation IN ('calisan', 'memur', 'emekli', 'ogrenci', 'issiz', 'sirket_sahibi', 'diger')),
  DROP CONSTRAINT IF EXISTS applications_nationality_check,
  ADD CONSTRAINT applications_nationality_check
    CHECK (nationality IS NULL OR nationality IN ('tc', 'diger'));

CREATE INDEX IF NOT EXISTS idx_applications_country_id ON public.applications(country_id);

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_not_blank CHECK (length(trim(name)) BETWEEN 1 AND 60),
  CONSTRAINT tags_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE IF NOT EXISTS public.customer_tags (
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  PRIMARY KEY (customer_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_customer ON public.customer_tags(tag_id, customer_id);

INSERT INTO public.tags (name, color)
VALUES
  ('VIP', '#D4AF37'),
  ('Acil', '#DC2626'),
  ('Reddi Var', '#EA580C'),
  ('Premium', '#9333EA')
ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color;

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_staff_read" ON public.tags
  FOR SELECT TO authenticated USING (public.current_staff_id() IS NOT NULL);
CREATE POLICY "tags_admin_manage" ON public.tags
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "customer_tags_assigned_read" ON public.customer_tags
  FOR SELECT TO authenticated USING (public.can_access_customer(customer_id));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.tags, public.customer_tags FROM authenticated;
GRANT SELECT ON TABLE public.tags, public.customer_tags TO authenticated;

CREATE OR REPLACE FUNCTION public.set_customer_tags_v1(
  p_customer_id UUID,
  p_tag_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  distinct_tag_ids UUID[] := ARRAY[]::UUID[];
  invalid_count INTEGER;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_access_customer(p_customer_id) THEN
    RAISE EXCEPTION 'customer_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT tag_id), ARRAY[]::UUID[])
  INTO distinct_tag_ids
  FROM unnest(COALESCE(p_tag_ids, ARRAY[]::UUID[])) AS requested(tag_id);

  IF cardinality(distinct_tag_ids) > 20 THEN
    RAISE EXCEPTION 'too_many_customer_tags' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO invalid_count
  FROM unnest(distinct_tag_ids) AS requested(requested_tag_id)
  WHERE NOT EXISTS (SELECT 1 FROM public.tags AS tag WHERE tag.id = requested_tag_id);
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'tag_not_found' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.customer_tags WHERE customer_id = p_customer_id;
  INSERT INTO public.customer_tags (customer_id, tag_id, created_by)
  SELECT p_customer_id, tag_id, actor_staff_id
  FROM unnest(distinct_tag_ids) AS requested(tag_id);

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  INSERT INTO public.activity_log (customer_id, action, performed_by, performed_by_staff_id, type)
  VALUES (
    p_customer_id,
    'Müşteri etiketleri güncellendi (' || cardinality(distinct_tag_ids) || ' etiket)',
    actor_name,
    actor_staff_id,
    'customer'
  );

  RETURN cardinality(distinct_tag_ids);
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
  IF NOT public.can_access_customer(p_customer_id) OR NOT public.can_access_application(p_application_id) THEN
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
    OR length(COALESCE(v_phone, '')) > 30 OR length(COALESCE(v_email, '')) > 254 THEN
    RAISE EXCEPTION 'customer_field_too_long' USING ERRCODE = '22001';
  END IF;
  IF v_financial_status NOT IN ('dusuk', 'orta', 'iyi', 'yuksek') THEN
    RAISE EXCEPTION 'invalid_financial_status' USING ERRCODE = '22023';
  END IF;
  IF v_visa_type NOT IN ('turistik', 'aile_ziyareti', 'aile_birlesimi', 'is', 'ogrenci', 'transit', 'tedavi', 'arastirma', 'kulturel_spor', 'calisma') THEN
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
    SELECT 1 FROM public.staff AS staff WHERE staff.id = v_target_staff_id AND staff.is_active = true
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
      profile_score = LEAST(100, GREATEST(0, COALESCE(NULLIF(p_payload->>'profile_score', '')::INTEGER, profile_score))),
      passport_no = NULLIF(trim(p_payload->>'passport_no'), ''),
      passport_expiry = NULLIF(p_payload->>'passport_expiry', '')::DATE,
      passport_issuing_country = COALESCE(NULLIF(trim(p_payload->>'passport_issuing_country'), ''), 'Türkiye'),
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
        WHEN p_payload ? 'with_children' AND NULLIF(p_payload->>'with_children', '') IS NOT NULL
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
      'Başvuru durumu düzenleme ekranından güncellendi: ' || v_current_status || ' → ' || v_new_status
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
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
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

REVOKE ALL ON FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_customer_tags_v1(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_application_v1(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_tags_v1(UUID, UUID[]) TO authenticated;

COMMIT;
