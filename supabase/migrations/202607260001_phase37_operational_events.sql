-- Faz 3.7.3: guvenli operasyon olaylari, admin gorunurlugu ve bildirimleri.

BEGIN;

CREATE TABLE public.operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  request_id UUID,
  route TEXT,
  error_code TEXT,
  summary TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_staff_id UUID
    CONSTRAINT operational_events_resolved_by_staff_fk
    REFERENCES public.staff(id) ON DELETE SET NULL,
  CONSTRAINT operational_events_key_valid
    CHECK (event_key IN (
      'health.readiness.failed',
      'backup.export.failed',
      'backup.restore.failed',
      'backup.stale',
      'restore.drill.failed',
      'webhook.google_form.failed',
      'tasks.operational_sync.failed',
      'notifications.task_sync.failed'
    )),
  CONSTRAINT operational_events_severity_valid
    CHECK (severity IN ('warning', 'error', 'critical')),
  CONSTRAINT operational_events_source_valid
    CHECK (source IN ('api', 'health', 'backup', 'restore', 'system')),
  CONSTRAINT operational_events_status_valid
    CHECK (status IN ('open', 'resolved')),
  CONSTRAINT operational_events_route_valid
    CHECK (route IS NULL OR route ~ '^/[A-Za-z0-9_./:{}-]{1,180}$'),
  CONSTRAINT operational_events_error_code_valid
    CHECK (error_code IS NULL OR error_code ~ '^[A-Za-z0-9_.:/-]{1,120}$'),
  CONSTRAINT operational_events_summary_length
    CHECK (length(summary) BETWEEN 1 AND 200),
  CONSTRAINT operational_events_occurrence_positive
    CHECK (occurrence_count > 0),
  CONSTRAINT operational_events_resolution_consistent
    CHECK (
      (status = 'open' AND resolved_at IS NULL AND resolved_by_staff_id IS NULL)
      OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by_staff_id IS NOT NULL)
    )
);

CREATE INDEX operational_events_open_last_seen_idx
  ON public.operational_events(severity, last_seen_at DESC)
  WHERE status = 'open';
CREATE INDEX operational_events_history_idx
  ON public.operational_events(last_seen_at DESC);

ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_events_admin_read
  ON public.operational_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.operational_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.operational_events FROM authenticated;
GRANT SELECT ON TABLE public.operational_events TO authenticated;
GRANT ALL ON TABLE public.operational_events TO service_role;

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
    'restore.drill.failed',
    'webhook.google_form.failed',
    'tasks.operational_sync.failed',
    'notifications.task_sync.failed'
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
    WHEN 'restore.drill.failed' THEN 'İzole geri yükleme tatbikatı başarısız oldu.'
    WHEN 'webhook.google_form.failed' THEN 'Google Form veri alma işlemi sunucu hatası verdi.'
    WHEN 'tasks.operational_sync.failed' THEN 'Operasyon görevleri eşitlenemedi.'
    WHEN 'notifications.task_sync.failed' THEN 'Bildirim görevleri eşitlenemedi.'
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
      recipient_staff_id,
      type,
      title,
      message,
      href,
      idempotency_key
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

CREATE OR REPLACE FUNCTION public.resolve_operational_event_v1(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  affected INTEGER;
BEGIN
  IF actor_staff_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.operational_events AS event
  SET status = 'resolved',
      resolved_at = now(),
      resolved_by_staff_id = actor_staff_id
  WHERE event.id = p_event_id
    AND event.status = 'open';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END
$$;

REVOKE ALL ON FUNCTION public.record_operational_event_v1(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_operational_event_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_operational_event_v1(TEXT, TEXT, TEXT, UUID, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_operational_event_v1(UUID) TO authenticated;

COMMIT;
