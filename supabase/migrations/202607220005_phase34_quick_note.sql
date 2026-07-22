-- Faz 3.4.5: musteri kartindan atomik hizli not ve audit akisi.

BEGIN;

CREATE OR REPLACE FUNCTION public.add_customer_quick_note_v1(
  p_customer_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  actor_name TEXT := 'Sistem';
  v_application_id UUID;
  v_note_id UUID;
  v_content TEXT := NULLIF(trim(p_content), '');
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_access_customer(p_customer_id) THEN
    RAISE EXCEPTION 'customer_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;
  IF v_content IS NULL OR length(v_content) > 2000 THEN
    RAISE EXCEPTION 'quick_note_required_max_2000' USING ERRCODE = '22023';
  END IF;

  SELECT application.id
  INTO v_application_id
  FROM public.applications AS application
  WHERE application.customer_id = p_customer_id
  ORDER BY application.created_at DESC
  LIMIT 1;
  IF v_application_id IS NULL THEN
    RAISE EXCEPTION 'customer_application_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name
  FROM public.staff AS staff
  WHERE staff.id = actor_staff_id;

  INSERT INTO public.notes (application_id, content, created_by, author)
  VALUES (v_application_id, v_content, actor_staff_id, actor_name)
  RETURNING id INTO v_note_id;

  INSERT INTO public.activity_log (
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  ) VALUES (
    v_application_id,
    p_customer_id,
    'Hızlı not eklendi',
    actor_name,
    actor_staff_id,
    'note'
  );

  RETURN v_note_id;
END
$$;

REVOKE ALL ON FUNCTION public.add_customer_quick_note_v1(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_customer_quick_note_v1(UUID, TEXT) TO authenticated;

COMMIT;
