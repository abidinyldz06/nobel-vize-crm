-- Faz 4.2: kullanici sayfa acmadan calisan, kilitli ve idempotent operasyon zamanlayicisi.

BEGIN;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_valid,
  DROP CONSTRAINT IF EXISTS tasks_source_valid;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_valid
    CHECK (task_type IN ('manual', 'appointment', 'document', 'payment', 'inactivity', 'passport')),
  ADD CONSTRAINT tasks_source_valid
    CHECK (source_type IN ('manual', 'appointment', 'document', 'payment', 'inactivity', 'passport'));

CREATE TABLE public.scheduled_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  window_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  inserted_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT scheduled_job_runs_job_valid
    CHECK (job_name IN ('operations', 'backup', 'messages')),
  CONSTRAINT scheduled_job_runs_window_valid
    CHECK (window_key ~ '^[0-9TZ:.-]{10,40}$'),
  CONSTRAINT scheduled_job_runs_status_valid
    CHECK (status IN ('started', 'succeeded', 'failed', 'skipped')),
  CONSTRAINT scheduled_job_runs_count_nonnegative CHECK (inserted_count >= 0),
  CONSTRAINT scheduled_job_runs_error_code_valid
    CHECK (error_code IS NULL OR error_code ~ '^[A-Za-z0-9_.:/-]{1,120}$'),
  CONSTRAINT scheduled_job_runs_state_consistent CHECK (
    (status = 'started' AND completed_at IS NULL AND error_code IS NULL)
    OR (status IN ('succeeded', 'skipped') AND completed_at IS NOT NULL AND error_code IS NULL)
    OR (status = 'failed' AND completed_at IS NOT NULL AND error_code IS NOT NULL)
  ),
  UNIQUE (job_name, window_key)
);

CREATE INDEX scheduled_job_runs_started_idx
  ON public.scheduled_job_runs(started_at DESC);

ALTER TABLE public.scheduled_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_job_runs_admin_read
  ON public.scheduled_job_runs FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.scheduled_job_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.scheduled_job_runs TO authenticated;
GRANT ALL ON TABLE public.scheduled_job_runs TO service_role;

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
    'Bekleyen ödeme: ' || customer.first_name || ' ' || customer.last_name,
    payment.amount::TEXT || ' ' || payment.currency || ' — ' || application.country,
    'payment', 'payment', payment.id, 'high', payment.created_at + interval '3 days',
    assignee.id, customer.id, application.id,
    'payment:' || payment.id::TEXT || ':pending'
  FROM public.payments AS payment
  JOIN public.applications AS application ON application.id = payment.application_id
  JOIN public.customers AS customer ON customer.id = application.customer_id AND customer.is_deleted = false
  JOIN public.staff AS assignee
    ON assignee.id = COALESCE(application.assigned_staff_id, customer.assigned_staff_id)
   AND assignee.is_active = true
  WHERE payment.status = 'bekliyor'
    AND payment.created_at <= now() - interval '3 days'
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
    created_count := public.sync_operational_tasks_v1();
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

REVOKE ALL ON FUNCTION public.run_scheduled_operations_v1(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_scheduled_operations_v1(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_operational_tasks_v1() TO service_role;

ALTER TABLE public.operational_events
  DROP CONSTRAINT IF EXISTS operational_events_key_valid;
ALTER TABLE public.operational_events
  ADD CONSTRAINT operational_events_key_valid CHECK (event_key IN (
    'health.readiness.failed',
    'backup.export.failed',
    'backup.restore.failed',
    'backup.stale',
    'backup.scheduled.failed',
    'restore.drill.failed',
    'webhook.google_form.failed',
    'tasks.operational_sync.failed',
    'notifications.task_sync.failed',
    'cron.operations.failed',
    'security.suspicious_login',
    'messages.delivery.failed'
  ));

CREATE OR REPLACE FUNCTION public.record_operational_event_v1(
  p_event_key TEXT,
  p_severity TEXT,
  p_source TEXT,
  p_request_id UUID DEFAULT NULL,
  p_route TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_id UUID;
  event_summary TEXT;
  event_fingerprint TEXT;
  is_new_event BOOLEAN := false;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_or_service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_event_key IS NULL OR p_event_key NOT IN (
    'health.readiness.failed',
    'backup.export.failed',
    'backup.restore.failed',
    'backup.stale',
    'backup.scheduled.failed',
    'restore.drill.failed',
    'webhook.google_form.failed',
    'tasks.operational_sync.failed',
    'notifications.task_sync.failed',
    'cron.operations.failed',
    'security.suspicious_login',
    'messages.delivery.failed'
  ) THEN
    RAISE EXCEPTION 'invalid_operational_event_key' USING ERRCODE = '22023';
  END IF;
  IF p_severity NOT IN ('warning', 'error', 'critical') THEN
    RAISE EXCEPTION 'invalid_operational_event_severity' USING ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('api', 'health', 'backup', 'restore', 'system') THEN
    RAISE EXCEPTION 'invalid_operational_event_source' USING ERRCODE = '22023';
  END IF;
  IF p_route IS NOT NULL AND p_route !~ '^/[A-Za-z0-9_./:{}-]{1,180}$' THEN
    RAISE EXCEPTION 'invalid_operational_event_route' USING ERRCODE = '22023';
  END IF;
  IF p_error_code IS NOT NULL AND p_error_code !~ '^[A-Za-z0-9_.:/-]{1,120}$' THEN
    RAISE EXCEPTION 'invalid_operational_error_code' USING ERRCODE = '22023';
  END IF;

  event_summary := CASE p_event_key
    WHEN 'health.readiness.failed' THEN 'Uygulama hazır olma kontrolü başarısız oldu.'
    WHEN 'backup.export.failed' THEN 'Uygulama veri yedeği oluşturulamadı.'
    WHEN 'backup.restore.failed' THEN 'Atomik geri yükleme işlemi başarısız oldu.'
    WHEN 'backup.stale' THEN 'Doğrulanmış güncel bir yedek bulunmuyor.'
    WHEN 'backup.scheduled.failed' THEN 'Zamanlanmış şifreli yedek tamamlanamadı.'
    WHEN 'restore.drill.failed' THEN 'İzole geri yükleme tatbikatı başarısız oldu.'
    WHEN 'webhook.google_form.failed' THEN 'Google Form veri alma işlemi sunucu hatası verdi.'
    WHEN 'tasks.operational_sync.failed' THEN 'Operasyon görevleri eşitlenemedi.'
    WHEN 'notifications.task_sync.failed' THEN 'Bildirim görevleri eşitlenemedi.'
    WHEN 'cron.operations.failed' THEN 'Zamanlanmış operasyon işi tamamlanamadı.'
    WHEN 'security.suspicious_login' THEN 'Şüpheli giriş davranışı engellendi.'
    WHEN 'messages.delivery.failed' THEN 'Mesaj kuyruğu işlenemedi.'
    ELSE 'Bir operasyon olayı kaydedildi.'
  END;

  event_fingerprint := concat_ws('|', p_event_key, COALESCE(p_error_code, ''), COALESCE(p_route, ''));
  PERFORM pg_advisory_xact_lock(hashtextextended(event_fingerprint, 0));

  SELECT event.id
  INTO event_id
  FROM public.operational_events AS event
  WHERE event.status = 'open'
    AND event.event_key = p_event_key
    AND event.error_code IS NOT DISTINCT FROM p_error_code
    AND event.route IS NOT DISTINCT FROM p_route
  ORDER BY event.first_seen_at
  LIMIT 1
  FOR UPDATE;

  IF event_id IS NULL THEN
    INSERT INTO public.operational_events (
      event_key, severity, source, request_id, route, error_code, summary
    )
    VALUES (
      p_event_key, p_severity, p_source, p_request_id, p_route, p_error_code, event_summary
    )
    RETURNING id INTO event_id;
    is_new_event := true;
  ELSE
    UPDATE public.operational_events AS event
    SET severity = CASE
          WHEN event.severity = 'critical' OR p_severity = 'critical' THEN 'critical'
          WHEN event.severity = 'error' OR p_severity = 'error' THEN 'error'
          ELSE 'warning'
        END,
        source = p_source,
        request_id = COALESCE(p_request_id, event.request_id),
        occurrence_count = event.occurrence_count + 1,
        last_seen_at = now()
    WHERE event.id = event_id;
  END IF;

  IF is_new_event THEN
    INSERT INTO public.notifications (
      recipient_staff_id, type, title, message, href, idempotency_key
    )
    SELECT
      staff.id,
      'operation',
      CASE p_severity
        WHEN 'critical' THEN 'Kritik sistem uyarısı'
        WHEN 'error' THEN 'Sistem hatası'
        ELSE 'Sistem uyarısı'
      END,
      event_summary,
      '/settings?tab=operations&event=' || event_id::TEXT,
      'operational-event:' || event_id::TEXT || ':' || staff.id::TEXT
    FROM public.staff AS staff
    WHERE staff.role = 'admin'
      AND staff.is_active = true
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  END IF;

  RETURN event_id;
END
$$;

COMMIT;
