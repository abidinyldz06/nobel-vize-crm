-- Faz 4.4: rol bazli MFA, giris kilidi, oturum gorunurlugu ve guvenlik audit izi.

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN admin_mfa_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN consultant_mfa_required BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE public.auth_login_attempts (
  key_hash TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  CONSTRAINT auth_login_attempts_key_valid CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT auth_login_attempts_count_valid CHECK (failure_count >= 0)
);

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_login_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_login_attempts TO service_role;

CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  staff_id UUID CONSTRAINT security_events_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  session_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT security_events_type_valid CHECK (event_type IN (
    'login_failed', 'login_locked', 'login_succeeded',
    'mfa_enrolled', 'mfa_verified', 'mfa_unenrolled',
    'other_sessions_revoked', 'password_changed'
  )),
  CONSTRAINT security_events_outcome_valid CHECK (outcome IN ('success', 'failure', 'blocked')),
  CONSTRAINT security_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX security_events_created_idx ON public.security_events(created_at DESC);
CREATE INDEX security_events_staff_idx ON public.security_events(staff_id, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_events_admin_read ON public.security_events
  FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON TABLE public.security_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.security_events FROM authenticated;
GRANT SELECT ON TABLE public.security_events TO authenticated;
GRANT ALL ON TABLE public.security_events TO service_role;

CREATE OR REPLACE FUNCTION public.check_login_rate_limit_v1(p_key_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt public.auth_login_attempts%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_login_key' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO attempt FROM public.auth_login_attempts WHERE key_hash = p_key_hash;
  IF attempt.locked_until IS NOT NULL AND attempt.locked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch FROM (attempt.locked_until - now())))::INTEGER)
    );
  END IF;
  RETURN jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
END
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt_v1(
  p_key_hash TEXT,
  p_success BOOLEAN,
  p_user_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  failures INTEGER;
  lock_until TIMESTAMPTZ;
  event_type_value TEXT;
  outcome_value TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_login_key' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));

  IF p_success THEN
    DELETE FROM public.auth_login_attempts WHERE key_hash = p_key_hash;
    event_type_value := 'login_succeeded';
    outcome_value := 'success';
    failures := 0;
  ELSE
    INSERT INTO public.auth_login_attempts(
      key_hash, failure_count, window_started_at, last_attempt_at, locked_until
    )
    VALUES (p_key_hash, 1, now(), now(), NULL)
    ON CONFLICT (key_hash) DO UPDATE
    SET failure_count = CASE
          WHEN public.auth_login_attempts.window_started_at < now() - interval '15 minutes' THEN 1
          ELSE public.auth_login_attempts.failure_count + 1
        END,
        window_started_at = CASE
          WHEN public.auth_login_attempts.window_started_at < now() - interval '15 minutes' THEN now()
          ELSE public.auth_login_attempts.window_started_at
        END,
        last_attempt_at = now(),
        locked_until = CASE
          WHEN (
            CASE
              WHEN public.auth_login_attempts.window_started_at < now() - interval '15 minutes' THEN 1
              ELSE public.auth_login_attempts.failure_count + 1
            END
          ) >= 5 THEN now() + interval '15 minutes'
          ELSE NULL
        END
    RETURNING failure_count, locked_until INTO failures, lock_until;
    event_type_value := CASE WHEN lock_until IS NULL THEN 'login_failed' ELSE 'login_locked' END;
    outcome_value := CASE WHEN lock_until IS NULL THEN 'failure' ELSE 'blocked' END;
  END IF;

  INSERT INTO public.security_events(user_id, staff_id, event_type, outcome, metadata)
  VALUES (
    p_user_id, p_staff_id, event_type_value, outcome_value,
    jsonb_build_object('failure_count', failures)
  );

  IF lock_until IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_staff_id, type, title, message, href, idempotency_key)
    SELECT
      staff.id, 'operation', 'Şüpheli giriş engellendi',
      'Tekrarlı başarısız giriş nedeniyle bir hesap geçici olarak kilitlendi.',
      '/settings?tab=security',
      'login-lock:' || p_key_hash || ':' || extract(epoch FROM lock_until)::BIGINT::TEXT || ':' || staff.id::TEXT
    FROM public.staff AS staff
    WHERE staff.role = 'admin' AND staff.is_active = true
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'failure_count', failures,
    'locked', lock_until IS NOT NULL,
    'locked_until', lock_until
  );
END
$$;

CREATE OR REPLACE FUNCTION public.record_own_security_event_v1(
  p_event_type TEXT,
  p_outcome TEXT DEFAULT 'success'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  result_id UUID;
  current_session_id UUID := NULLIF(auth.jwt()->>'session_id', '')::UUID;
BEGIN
  IF actor_staff_id IS NULL THEN
    RAISE EXCEPTION 'active_staff_required' USING ERRCODE = '42501';
  END IF;
  IF p_event_type NOT IN (
    'mfa_enrolled', 'mfa_verified', 'mfa_unenrolled',
    'other_sessions_revoked', 'password_changed'
  ) OR p_outcome NOT IN ('success', 'failure') THEN
    RAISE EXCEPTION 'invalid_security_event' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.security_events(user_id, staff_id, event_type, outcome, session_id)
  VALUES (auth.uid(), actor_staff_id, p_event_type, p_outcome, current_session_id)
  RETURNING id INTO result_id;
  RETURN result_id;
END
$$;

CREATE OR REPLACE FUNCTION public.list_current_user_sessions_v1()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'created_at', session.created_at,
    'updated_at', session.updated_at,
    'user_agent', left(COALESCE(session.user_agent, 'Bilinmeyen cihaz'), 300),
    'is_current', session.id = NULLIF(auth.jwt()->>'session_id', '')::UUID
  ) ORDER BY session.updated_at DESC), '[]'::JSONB)
  FROM auth.sessions AS session
  WHERE session.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.check_login_rate_limit_v1(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_attempt_v1(TEXT, BOOLEAN, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_own_security_event_v1(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_current_user_sessions_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit_v1(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt_v1(TEXT, BOOLEAN, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_own_security_event_v1(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_current_user_sessions_v1() TO authenticated;

COMMIT;
