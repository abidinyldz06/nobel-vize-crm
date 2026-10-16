-- Extranet denemelerini IP ve başvuru referansı karmaları üzerinden sınırlar.
-- Ham IP, token veya pasaport bu tabloda tutulmaz.

BEGIN;

CREATE OR REPLACE FUNCTION public.consume_portal_rate_limit_v1(
  p_pair_hash TEXT,
  p_ip_hash TEXT,
  p_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  first_hash TEXT;
  second_hash TEXT;
  hash_value TEXT;
  limit_value INTEGER;
  failures INTEGER;
  lock_until TIMESTAMPTZ;
  blocked BOOLEAN := false;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_pair_hash IS NULL OR p_ip_hash IS NULL
     OR p_pair_hash !~ '^[a-f0-9]{64}$'
     OR p_ip_hash !~ '^[a-f0-9]{64}$'
     OR p_outcome NOT IN ('check', 'success', 'failure') THEN
    RAISE EXCEPTION 'invalid_portal_key' USING ERRCODE = '22023';
  END IF;

  IF p_pair_hash <= p_ip_hash THEN
    first_hash := p_pair_hash;
    second_hash := p_ip_hash;
  ELSE
    first_hash := p_ip_hash;
    second_hash := p_pair_hash;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(first_hash, 0));
  IF second_hash <> first_hash THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(second_hash, 0));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_login_attempts
    WHERE key_hash IN (p_pair_hash, p_ip_hash)
      AND locked_until IS NOT NULL
      AND locked_until > now()
  ) THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  IF p_outcome = 'check' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  IF p_outcome = 'success' THEN
    DELETE FROM public.auth_login_attempts WHERE key_hash = p_pair_hash;
    RETURN jsonb_build_object('allowed', true);
  END IF;

  FOR hash_value, limit_value IN
    SELECT p_pair_hash, 8
    UNION ALL
    SELECT p_ip_hash, 30
  LOOP
    INSERT INTO public.auth_login_attempts(
      key_hash, failure_count, window_started_at, last_attempt_at, locked_until
    )
    VALUES (hash_value, 1, now(), now(), NULL)
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
          ) >= limit_value THEN now() + interval '15 minutes'
          ELSE NULL
        END
    RETURNING failure_count, locked_until INTO failures, lock_until;
    IF lock_until IS NOT NULL THEN
      blocked := true;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('allowed', NOT blocked, 'failure_count', failures);
END
$$;

REVOKE ALL ON FUNCTION public.consume_portal_rate_limit_v1(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_portal_rate_limit_v1(TEXT, TEXT, TEXT) TO service_role;

COMMIT;
