-- Faz 4.8: randevu gecmisi, cakisma uyarisi ve kanonik rapor alanlari.

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN appointment_status TEXT,
  ADD COLUMN appointment_duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN appointment_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul';
UPDATE public.applications
SET appointment_status = 'scheduled'
WHERE appointment_date IS NOT NULL;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_appointment_status_valid CHECK (
    appointment_status IS NULL OR appointment_status IN (
      'scheduled', 'rescheduled', 'cancelled', 'no_show', 'completed'
    )
  ),
  ADD CONSTRAINT applications_appointment_duration_valid CHECK (
    appointment_duration_minutes BETWEEN 15 AND 480
  ),
  ADD CONSTRAINT applications_appointment_timezone_valid CHECK (
    appointment_timezone = 'Europe/Istanbul'
  ),
  ADD CONSTRAINT applications_appointment_state_consistent CHECK (
    (appointment_date IS NULL AND appointment_status IS NULL)
    OR (appointment_date IS NOT NULL AND appointment_status IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.normalize_application_appointment_state_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.appointment_date IS NULL THEN
    NEW.appointment_status := NULL;
  ELSIF NEW.appointment_status IS NULL THEN
    NEW.appointment_status := 'scheduled';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER applications_normalize_appointment_state
  BEFORE INSERT OR UPDATE OF appointment_date, appointment_status
  ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.normalize_application_appointment_state_v1();

CREATE TABLE public.appointment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_date TIMESTAMPTZ,
  appointment_date TIMESTAMPTZ,
  location TEXT,
  duration_minutes INTEGER,
  actor_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointment_events_type_valid CHECK (
    event_type IN ('scheduled', 'rescheduled', 'cancelled', 'no_show', 'completed')
  ),
  CONSTRAINT appointment_events_location_length CHECK (location IS NULL OR length(location) <= 240),
  CONSTRAINT appointment_events_duration_valid CHECK (
    duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 480
  ),
  CONSTRAINT appointment_events_note_length CHECK (note IS NULL OR length(note) <= 1000)
);
CREATE INDEX appointment_events_application_created_idx
  ON public.appointment_events(application_id, created_at DESC);
CREATE TRIGGER appointment_events_immutable
  BEFORE UPDATE OR DELETE ON public.appointment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privacy_audit_mutation_v1();
ALTER TABLE public.appointment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointment_events_authorized_read ON public.appointment_events
  FOR SELECT TO authenticated USING (public.can_access_application(application_id));
REVOKE ALL ON public.appointment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_events TO authenticated;
GRANT ALL ON public.appointment_events TO service_role;

INSERT INTO public.appointment_events (
  application_id, customer_id, event_type, appointment_date, location,
  duration_minutes, note
)
SELECT
  application.id, application.customer_id, 'scheduled', application.appointment_date,
  application.appointment_location, application.appointment_duration_minutes,
  'Mevcut randevu Faz 4.8 geçişinde geçmişe alındı.'
FROM public.applications application
WHERE application.appointment_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.list_appointment_conflicts_v1(
  p_application_id UUID,
  p_appointment_date TIMESTAMPTZ,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  application_id UUID,
  appointment_date TIMESTAMPTZ,
  appointment_location TEXT,
  customer_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE target_staff_id UUID;
BEGIN
  IF NOT public.can_access_application(p_application_id) THEN
    RAISE EXCEPTION 'application_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_appointment_date IS NULL OR p_duration_minutes NOT BETWEEN 15 AND 480 THEN
    RAISE EXCEPTION 'appointment_conflict_payload_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
  INTO target_staff_id
  FROM public.applications application
  JOIN public.customers customer ON customer.id = application.customer_id
  WHERE application.id = p_application_id;

  RETURN QUERY
  SELECT
    application.id,
    application.appointment_date,
    application.appointment_location,
    customer.first_name || ' ' || customer.last_name
  FROM public.applications application
  JOIN public.customers customer ON customer.id = application.customer_id
  WHERE application.id <> p_application_id
    AND customer.is_deleted = false
    AND application.appointment_date IS NOT NULL
    AND application.appointment_status IN ('scheduled', 'rescheduled')
    AND COALESCE(application.assigned_staff_id, customer.assigned_staff_id) = target_staff_id
    AND application.appointment_date
      < p_appointment_date + make_interval(mins => p_duration_minutes)
    AND application.appointment_date
        + make_interval(mins => application.appointment_duration_minutes)
      > p_appointment_date
    AND (public.is_admin() OR public.can_access_application(application.id))
  ORDER BY application.appointment_date;
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
  v_previous_date TIMESTAMPTZ;
  v_event_type TEXT;
  v_conflict_count INTEGER;
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
  SELECT application.customer_id, application.status, application.appointment_date
  INTO v_customer_id, v_current_status, v_previous_date
  FROM public.applications application
  WHERE application.id = p_application_id
  FOR UPDATE;
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'application_not_found_or_not_accessible' USING ERRCODE = 'P0002';
  END IF;
  IF v_current_status <> 'randevu_alindi'
    AND NOT public.application_status_transition_allowed(v_current_status, 'randevu_alindi') THEN
    RAISE EXCEPTION 'application_status_transition_not_allowed:%->randevu_alindi',
      v_current_status USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(NULLIF(staff.full_name, ''), staff.email, 'Sistem')
  INTO actor_name FROM public.staff staff WHERE staff.id = actor_staff_id;
  SELECT count(*) INTO v_conflict_count
  FROM public.list_appointment_conflicts_v1(p_application_id, p_appointment_date, 60);
  v_event_type := CASE WHEN v_previous_date IS NULL THEN 'scheduled' ELSE 'rescheduled' END;

  UPDATE public.applications SET
    appointment_date = p_appointment_date,
    appointment_location = trim(p_location),
    appointment_status = v_event_type,
    appointment_duration_minutes = 60,
    appointment_timezone = 'Europe/Istanbul',
    status = 'randevu_alindi',
    rejection_reason = NULL
  WHERE id = p_application_id;
  INSERT INTO public.appointment_events(
    application_id, customer_id, event_type, previous_date, appointment_date,
    location, duration_minutes, actor_staff_id, note
  ) VALUES (
    p_application_id, v_customer_id, v_event_type, v_previous_date, p_appointment_date,
    trim(p_location), 60, actor_staff_id,
    COALESCE(NULLIF(trim(p_system), ''), 'VFS') || ' sistemi'
  );
  INSERT INTO public.activity_log(
    application_id, customer_id, action, performed_by, performed_by_staff_id, type
  ) VALUES (
    p_application_id, v_customer_id,
    CASE WHEN v_event_type = 'scheduled' THEN 'Randevu eklendi: ' ELSE 'Randevu ertelendi: ' END
      || COALESCE(NULLIF(trim(p_system), ''), 'VFS') || ' — '
      || to_char(p_appointment_date AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI')
      || ' (' || trim(p_location) || ')',
    actor_name, actor_staff_id, 'appointment'
  );
  RETURN jsonb_build_object(
    'application_id', p_application_id,
    'customer_id', v_customer_id,
    'previous_status', v_current_status,
    'status', 'randevu_alindi',
    'appointment_status', v_event_type,
    'conflict_count', v_conflict_count
  );
END
$$;

CREATE OR REPLACE FUNCTION public.set_appointment_status_v1(
  p_application_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  target public.applications%ROWTYPE;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.can_access_application(p_application_id) THEN
    RAISE EXCEPTION 'application_access_denied' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('cancelled', 'no_show', 'completed') THEN
    RAISE EXCEPTION 'appointment_status_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NOT NULL AND length(p_note) > 1000 THEN
    RAISE EXCEPTION 'appointment_note_too_long' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.applications WHERE id = p_application_id FOR UPDATE;
  IF target.appointment_date IS NULL OR target.appointment_status NOT IN ('scheduled', 'rescheduled') THEN
    RAISE EXCEPTION 'active_appointment_required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.applications SET appointment_status = p_status WHERE id = p_application_id;
  INSERT INTO public.appointment_events(
    application_id, customer_id, event_type, appointment_date, location,
    duration_minutes, actor_staff_id, note
  ) VALUES (
    target.id, target.customer_id, p_status, target.appointment_date,
    target.appointment_location, target.appointment_duration_minutes,
    actor_staff_id, NULLIF(btrim(COALESCE(p_note, '')), '')
  );
  INSERT INTO public.activity_log(
    application_id, customer_id, action, performed_by_staff_id, type
  ) VALUES (
    target.id, target.customer_id, 'Randevu durumu güncellendi: ' || p_status,
    actor_staff_id, 'appointment'
  );
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.list_appointment_conflicts_v1(UUID, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_appointment_status_v1(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.normalize_application_appointment_state_v1()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_appointment_conflicts_v1(UUID, TIMESTAMPTZ, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_appointment_status_v1(UUID, TEXT, TEXT)
  TO authenticated;

COMMIT;
