-- Faz 3.4.1: kontrollu basvuru gecisleri ve atomik randevu/toplu durum akislari.

BEGIN;

CREATE OR REPLACE FUNCTION public.application_status_transition_allowed(
  p_from TEXT,
  p_to TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_from
    WHEN 'profil_analizi' THEN p_to IN ('evrak_bekleniyor', 'randevu_alindi', 'kapandi')
    WHEN 'evrak_bekleniyor' THEN p_to IN ('profil_analizi', 'randevu_bekleniyor', 'randevu_alindi', 'evrak_hazirlaniyor', 'kapandi')
    WHEN 'randevu_bekleniyor' THEN p_to IN ('evrak_bekleniyor', 'randevu_alindi', 'kapandi')
    WHEN 'randevu_alindi' THEN p_to IN ('randevu_bekleniyor', 'evrak_hazirlaniyor', 'basvuru_yapildi', 'kapandi')
    WHEN 'evrak_hazirlaniyor' THEN p_to IN ('evrak_bekleniyor', 'randevu_bekleniyor', 'randevu_alindi', 'basvuru_yapildi', 'kapandi')
    WHEN 'basvuru_yapildi' THEN p_to IN ('evrak_hazirlaniyor', 'onaylandi', 'reddedildi', 'kapandi')
    WHEN 'reddedildi' THEN p_to IN ('itiraz', 'kapandi')
    WHEN 'itiraz' THEN p_to IN ('onaylandi', 'reddedildi', 'kapandi')
    WHEN 'onaylandi' THEN p_to = 'kapandi'
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_application_status_v1(
  p_application_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  v_customer_id UUID;
  v_current_status TEXT;
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
  IF NOT public.can_access_application(p_application_id) THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;

  SELECT application.customer_id, application.status
  INTO v_customer_id, v_current_status
  FROM public.applications AS application
  WHERE application.id = p_application_id
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.application_status_transition_allowed(v_current_status, p_status) THEN
    RAISE EXCEPTION 'application_status_transition_not_allowed:%->%', v_current_status, p_status
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  UPDATE public.applications
  SET
    status = p_status,
    rejection_reason = CASE WHEN p_status = 'reddedildi' THEN trim(p_rejection_reason) ELSE NULL END
  WHERE id = p_application_id;

  INSERT INTO public.activity_log (
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  ) VALUES (
    p_application_id,
    v_customer_id,
    COALESCE(NULLIF(trim(p_action), ''), 'Başvuru durumu güncellendi: ' || v_current_status || ' → ' || p_status),
    actor_name,
    actor_staff_id,
    'status'
  );

  RETURN jsonb_build_object(
    'application_id', p_application_id,
    'customer_id', v_customer_id,
    'previous_status', v_current_status,
    'status', p_status
  );
END
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_application_status_v1(
  p_application_ids UUID[],
  p_status TEXT,
  p_action TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  distinct_count INTEGER;
  visible_count INTEGER;
  affected INTEGER;
  invalid_transition TEXT;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF p_application_ids IS NULL OR cardinality(p_application_ids) = 0 OR cardinality(p_application_ids) > 100 THEN
    RAISE EXCEPTION 'application_ids_required_max_100' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'reddedildi' THEN
    RAISE EXCEPTION 'bulk_rejection_not_allowed' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT application_id)
  INTO distinct_count
  FROM unnest(p_application_ids) AS application_id;

  PERFORM application.id
  FROM public.applications AS application
  WHERE application.id = ANY(p_application_ids)
  FOR UPDATE;

  SELECT count(*)
  INTO visible_count
  FROM public.applications AS application
  WHERE application.id = ANY(p_application_ids)
    AND public.can_access_application(application.id);

  IF visible_count <> distinct_count THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;

  SELECT application.status || '->' || p_status
  INTO invalid_transition
  FROM public.applications AS application
  WHERE application.id = ANY(p_application_ids)
    AND NOT public.application_status_transition_allowed(application.status, p_status)
  LIMIT 1;

  IF invalid_transition IS NOT NULL THEN
    RAISE EXCEPTION 'application_status_transition_not_allowed:%', invalid_transition USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  INSERT INTO public.activity_log (
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  )
  SELECT
    application.id,
    application.customer_id,
    COALESCE(NULLIF(trim(p_action), ''), 'Başvuru durumu toplu güncellendi: ' || application.status || ' → ' || p_status),
    actor_name,
    actor_staff_id,
    'status'
  FROM public.applications AS application
  WHERE application.id = ANY(p_application_ids);

  UPDATE public.applications AS application
  SET status = p_status,
      rejection_reason = NULL
  WHERE application.id = ANY(p_application_ids);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END
$$;

CREATE OR REPLACE FUNCTION public.set_application_appointment_v1(
  p_application_id UUID,
  p_appointment_date TIMESTAMPTZ,
  p_location TEXT,
  p_system TEXT DEFAULT 'VFS'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  v_customer_id UUID;
  v_current_status TEXT;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF p_appointment_date IS NULL OR NULLIF(trim(p_location), '') IS NULL THEN
    RAISE EXCEPTION 'appointment_date_and_location_required' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_location)) > 240 OR length(COALESCE(trim(p_system), '')) > 80 THEN
    RAISE EXCEPTION 'appointment_field_too_long' USING ERRCODE = '22001';
  END IF;
  IF NOT public.can_access_application(p_application_id) THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;

  SELECT application.customer_id, application.status
  INTO v_customer_id, v_current_status
  FROM public.applications AS application
  WHERE application.id = p_application_id
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_status <> 'randevu_alindi'
    AND NOT public.application_status_transition_allowed(v_current_status, 'randevu_alindi') THEN
    RAISE EXCEPTION 'application_status_transition_not_allowed:%->randevu_alindi', v_current_status USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  UPDATE public.applications
  SET appointment_date = p_appointment_date,
      appointment_location = trim(p_location),
      status = 'randevu_alindi',
      rejection_reason = NULL
  WHERE id = p_application_id;

  INSERT INTO public.activity_log (
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  ) VALUES (
    p_application_id,
    v_customer_id,
    'Randevu eklendi: ' || COALESCE(NULLIF(trim(p_system), ''), 'VFS') || ' — '
      || to_char(p_appointment_date AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
      || ' (' || trim(p_location) || ')',
    actor_name,
    actor_staff_id,
    'appointment'
  );

  RETURN jsonb_build_object(
    'application_id', p_application_id,
    'customer_id', v_customer_id,
    'previous_status', v_current_status,
    'status', 'randevu_alindi'
  );
END
$$;

REVOKE ALL ON FUNCTION public.application_status_transition_allowed(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE UPDATE ON TABLE public.applications FROM authenticated;
REVOKE ALL ON FUNCTION public.bulk_update_application_status_v1(UUID[], TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_application_appointment_v1(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.application_status_transition_allowed(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_update_application_status_v1(UUID[], TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_application_appointment_v1(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
