-- Faz 5.3: tahsilat vadesi, danışman kapasitesi ve zamanlanmış yük uyarıları.

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN due_at TIMESTAMPTZ;

CREATE INDEX payments_pending_due_idx
  ON public.payments(due_at)
  WHERE status = 'bekliyor' AND due_at IS NOT NULL;

CREATE TABLE public.staff_capacity (
  staff_id UUID PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  max_active_applications INTEGER NOT NULL DEFAULT 25,
  max_open_tasks INTEGER NOT NULL DEFAULT 40,
  updated_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_capacity_active_applications_range
    CHECK (max_active_applications BETWEEN 1 AND 250),
  CONSTRAINT staff_capacity_open_tasks_range
    CHECK (max_open_tasks BETWEEN 1 AND 500)
);

ALTER TABLE public.staff_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_capacity_admin_read ON public.staff_capacity
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON TABLE public.staff_capacity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.staff_capacity TO authenticated;
GRANT ALL ON TABLE public.staff_capacity TO service_role;

CREATE OR REPLACE FUNCTION public.set_staff_capacity_v1(
  p_staff_id UUID,
  p_max_active_applications INTEGER,
  p_max_open_tasks INTEGER
)
RETURNS public.staff_capacity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  result public.staff_capacity;
  target_name TEXT;
BEGIN
  IF NOT public.is_admin() OR actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_staff_id IS NULL
    OR p_max_active_applications NOT BETWEEN 1 AND 250
    OR p_max_open_tasks NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'capacity_payload_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO target_name
  FROM public.staff
  WHERE id = p_staff_id;
  IF target_name IS NULL THEN
    RAISE EXCEPTION 'staff_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.staff_capacity (
    staff_id, max_active_applications, max_open_tasks, updated_by_staff_id
  )
  VALUES (
    p_staff_id, p_max_active_applications, p_max_open_tasks, actor_staff_id
  )
  ON CONFLICT (staff_id) DO UPDATE
  SET
    max_active_applications = EXCLUDED.max_active_applications,
    max_open_tasks = EXCLUDED.max_open_tasks,
    updated_by_staff_id = EXCLUDED.updated_by_staff_id,
    updated_at = now()
  RETURNING * INTO result;

  INSERT INTO public.activity_log (
    action, performed_by, performed_by_staff_id, type
  )
  SELECT
    'Personel kapasitesi güncellendi: ' || target_name || ' — '
      || p_max_active_applications::TEXT || ' aktif başvuru, '
      || p_max_open_tasks::TEXT || ' açık görev',
    actor.full_name,
    actor_staff_id,
    'operational'
  FROM public.staff AS actor
  WHERE actor.id = actor_staff_id;

  RETURN result;
END
$$;

REVOKE ALL ON FUNCTION public.set_staff_capacity_v1(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_capacity_v1(UUID, INTEGER, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_operational_tasks_v1()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  service_invocation BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  inserted_count INTEGER := 0;
  step_count INTEGER := 0;
BEGIN
  IF actor_staff_id IS NULL AND NOT service_invocation THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    CASE WHEN customer.passport_expiry < current_date
      THEN 'Süresi dolmuş pasaport: '
      ELSE 'Pasaport yenileme: '
    END || customer.first_name || ' ' || customer.last_name,
    'Pasaport bitiş tarihi: ' || to_char(customer.passport_expiry, 'DD.MM.YYYY'),
    'passport', 'passport', customer.id,
    CASE
      WHEN customer.passport_expiry < current_date THEN 'urgent'
      WHEN customer.passport_expiry <= current_date + 30 THEN 'urgent'
      ELSE 'high'
    END,
    (customer.passport_expiry::TIMESTAMPTZ - interval '180 days'),
    assignee.id, customer.id, NULL,
    'passport:' || customer.id::TEXT || ':' || customer.passport_expiry::TEXT
  FROM public.customers AS customer
  JOIN public.staff AS assignee
    ON assignee.id = customer.assigned_staff_id
   AND assignee.is_active = true
  WHERE customer.is_deleted = false
    AND customer.passport_expiry IS NOT NULL
    AND customer.passport_expiry <= current_date + 180
    AND (service_invocation OR public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Yaklaşan randevu: ' || customer.first_name || ' ' || customer.last_name,
    application.country || ' randevusu ' || to_char(application.appointment_date AT TIME ZONE 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'),
    'appointment', 'appointment', application.id, 'urgent',
    application.appointment_date - interval '24 hours',
    assignee.id, customer.id, application.id,
    'appointment:' || application.id::TEXT || ':' || extract(epoch FROM application.appointment_date)::BIGINT::TEXT
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE application.appointment_date > now()
    AND application.appointment_date <= now() + interval '48 hours'
    AND (service_invocation OR public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Geciken evrak: ' || document.document_type,
    customer.first_name || ' ' || customer.last_name || ' — ' || application.country,
    'document', 'document', document.id,
    CASE WHEN document.requested_at <= now() - interval '7 days' THEN 'urgent' ELSE 'high' END,
    document.requested_at + interval '3 days',
    assignee.id, customer.id, application.id,
    'document:' || document.id::TEXT || ':overdue'
  FROM public.documents AS document
  JOIN public.applications AS application ON application.id = document.application_id
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE document.is_required = true
    AND document.status = 'bekleniyor'
    AND document.requested_at <= now() - interval '3 days'
    AND (service_invocation OR public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Geciken ödeme: ' || customer.first_name || ' ' || customer.last_name,
    payment.amount::TEXT || ' ' || payment.currency || ' — ' || application.country,
    'payment', 'payment', payment.id,
    CASE
      WHEN COALESCE(payment.due_at, payment.created_at + interval '3 days') <= now() - interval '7 days'
        THEN 'urgent'
      ELSE 'high'
    END,
    COALESCE(payment.due_at, payment.created_at + interval '3 days'),
    assignee.id, customer.id, application.id,
    'payment:' || payment.id::TEXT || ':pending'
  FROM public.payments AS payment
  JOIN public.applications AS application ON application.id = payment.application_id
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE payment.status = 'bekliyor'
    AND COALESCE(payment.due_at, payment.created_at + interval '3 days') <= now()
    AND (service_invocation OR public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  INSERT INTO public.tasks (
    title, description, task_type, source_type, source_id, priority, due_at,
    assigned_staff_id, customer_id, application_id, idempotency_key
  )
  SELECT
    'Hareketsiz başvuru: ' || customer.first_name || ' ' || customer.last_name,
    application.country || ' başvurusu 7 gündür güncellenmedi.',
    'inactivity', 'inactivity', application.id, 'normal',
    application.updated_at + interval '7 days',
    assignee.id, customer.id, application.id,
    'inactivity:' || application.id::TEXT || ':' || extract(epoch FROM application.updated_at)::BIGINT::TEXT
  FROM public.applications AS application
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
    AND application.updated_at <= now() - interval '7 days'
    AND (service_invocation OR public.is_admin() OR assignee.id = actor_staff_id)
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  inserted_count := inserted_count + step_count;

  RETURN inserted_count;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_staff_capacity_alerts_v1()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_count INTEGER := 0;
  week_key TEXT := to_char(now() AT TIME ZONE 'Europe/Istanbul', 'IYYY-IW');
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  WITH workload AS (
    SELECT
      staff.id AS staff_id,
      staff.full_name,
      capacity.max_active_applications,
      capacity.max_open_tasks,
      COUNT(DISTINCT application.id) FILTER (
        WHERE application.status NOT IN ('onaylandi', 'reddedildi', 'kapandi')
      ) AS active_applications,
      COUNT(DISTINCT task.id) FILTER (
        WHERE task.status IN ('pending', 'in_progress')
      ) AS open_tasks
    FROM public.staff AS staff
    JOIN public.staff_capacity AS capacity ON capacity.staff_id = staff.id
    LEFT JOIN public.applications AS application
      ON application.assigned_staff_id = staff.id
    LEFT JOIN public.tasks AS task ON task.assigned_staff_id = staff.id
    WHERE staff.is_active = true
    GROUP BY staff.id, staff.full_name, capacity.max_active_applications, capacity.max_open_tasks
  ), alerts AS (
    SELECT
      staff_id,
      'capacity:applications:' || staff_id::TEXT || ':' || week_key AS idempotency_key,
      'Başvuru kapasitesi aşıldı' AS title,
      active_applications::TEXT || ' aktif başvuru var; tanımlı limit '
        || max_active_applications::TEXT || '.' AS message
    FROM workload
    WHERE active_applications > max_active_applications
    UNION ALL
    SELECT
      staff_id,
      'capacity:tasks:' || staff_id::TEXT || ':' || week_key,
      'Görev kapasitesi aşıldı',
      open_tasks::TEXT || ' açık görev var; tanımlı limit '
        || max_open_tasks::TEXT || '.'
    FROM workload
    WHERE open_tasks > max_open_tasks
  )
  INSERT INTO public.notifications (
    recipient_staff_id, type, title, message, href, idempotency_key
  )
  SELECT
    staff_id, 'capacity', title, message, '/tasks', idempotency_key
  FROM alerts
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN inserted_count;
END
$$;

CREATE OR REPLACE FUNCTION public.run_scheduled_operations_v1(p_window_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  run_id UUID;
  created_count INTEGER := 0;
  existing_status TEXT;
  lock_acquired BOOLEAN;
  failure_code TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_window_key IS NULL OR p_window_key !~ '^[0-9TZ:.-]{10,40}$' THEN
    RAISE EXCEPTION 'invalid_window_key' USING ERRCODE = '22023';
  END IF;

  SELECT pg_try_advisory_xact_lock(hashtextextended('nobel-crm:scheduled-operations', 0))
    INTO lock_acquired;
  IF NOT lock_acquired THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'concurrent_run');
  END IF;

  SELECT status INTO existing_status
  FROM public.scheduled_job_runs
  WHERE job_name = 'operations' AND window_key = p_window_key;
  IF existing_status IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'window_already_processed');
  END IF;

  INSERT INTO public.scheduled_job_runs(job_name, window_key)
  VALUES ('operations', p_window_key)
  RETURNING id INTO run_id;

  BEGIN
    created_count := public.sync_operational_tasks_v1()
      + public.sync_staff_capacity_alerts_v1();
    UPDATE public.scheduled_job_runs
    SET status = 'succeeded', inserted_count = created_count, completed_at = now()
    WHERE id = run_id;
    RETURN jsonb_build_object('status', 'succeeded', 'inserted_count', created_count, 'run_id', run_id);
  EXCEPTION WHEN OTHERS THEN
    failure_code := COALESCE(NULLIF(SQLSTATE, ''), 'scheduled_operations_failed');
    UPDATE public.scheduled_job_runs
    SET status = 'failed', error_code = failure_code, completed_at = now()
    WHERE id = run_id;
    RETURN jsonb_build_object('status', 'failed', 'error_code', failure_code, 'run_id', run_id);
  END;
END
$$;

REVOKE ALL ON FUNCTION public.sync_staff_capacity_alerts_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_staff_capacity_alerts_v1() TO service_role;
REVOKE ALL ON FUNCTION public.run_scheduled_operations_v1(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_scheduled_operations_v1(TEXT) TO service_role;

COMMIT;
