-- Faz 3.7.4: veritabani ve Storage yedek calismalari ile butunluk dogrulamasi.

BEGIN;

CREATE TABLE public.backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_kind TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'started',
  format_version TEXT NOT NULL DEFAULT '2.0',
  artifact_label TEXT NOT NULL,
  database_table_count INTEGER,
  database_row_count BIGINT,
  storage_object_count BIGINT,
  storage_bytes BIGINT,
  checksum_sha256 TEXT,
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_by_staff_id UUID
    CONSTRAINT backup_runs_created_by_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  verified_by_staff_id UUID
    CONSTRAINT backup_runs_verified_by_staff_fk REFERENCES public.staff(id) ON DELETE SET NULL,
  CONSTRAINT backup_runs_kind_valid
    CHECK (backup_kind IN ('database', 'storage', 'full')),
  CONSTRAINT backup_runs_trigger_valid
    CHECK (trigger_type IN ('manual', 'scheduled', 'deployment')),
  CONSTRAINT backup_runs_status_valid
    CHECK (status IN ('started', 'completed', 'failed', 'verified')),
  CONSTRAINT backup_runs_artifact_label_valid
    CHECK (artifact_label ~ '^[A-Za-z0-9_.-]{1,160}$'),
  CONSTRAINT backup_runs_counts_nonnegative CHECK (
    (database_table_count IS NULL OR database_table_count >= 0)
    AND (database_row_count IS NULL OR database_row_count >= 0)
    AND (storage_object_count IS NULL OR storage_object_count >= 0)
    AND (storage_bytes IS NULL OR storage_bytes >= 0)
  ),
  CONSTRAINT backup_runs_checksum_valid
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT backup_runs_error_code_valid
    CHECK (error_code IS NULL OR error_code ~ '^[A-Za-z0-9_.:/-]{1,120}$'),
  CONSTRAINT backup_runs_state_consistent CHECK (
    (status = 'started'
      AND completed_at IS NULL
      AND verified_at IS NULL
      AND checksum_sha256 IS NULL
      AND error_code IS NULL)
    OR (status = 'completed'
      AND completed_at IS NOT NULL
      AND verified_at IS NULL
      AND checksum_sha256 IS NOT NULL
      AND error_code IS NULL)
    OR (status = 'failed'
      AND completed_at IS NOT NULL
      AND verified_at IS NULL
      AND checksum_sha256 IS NULL
      AND error_code IS NOT NULL)
    OR (status = 'verified'
      AND completed_at IS NOT NULL
      AND verified_at IS NOT NULL
      AND checksum_sha256 IS NOT NULL
      AND error_code IS NULL)
  )
);

CREATE INDEX backup_runs_started_idx
  ON public.backup_runs(started_at DESC);
CREATE INDEX backup_runs_verified_idx
  ON public.backup_runs(verified_at DESC)
  WHERE status = 'verified';

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY backup_runs_admin_read
  ON public.backup_runs
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.backup_runs FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.backup_runs FROM authenticated;
GRANT SELECT ON TABLE public.backup_runs TO authenticated;
GRANT ALL ON TABLE public.backup_runs TO service_role;

CREATE OR REPLACE FUNCTION public.start_backup_run_v1(
  p_backup_kind TEXT,
  p_trigger_type TEXT,
  p_artifact_label TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  run_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND (actor_staff_id IS NULL OR NOT public.is_admin()) THEN
    RAISE EXCEPTION 'admin_or_service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_backup_kind NOT IN ('database', 'storage', 'full') THEN
    RAISE EXCEPTION 'invalid_backup_kind' USING ERRCODE = '22023';
  END IF;
  IF p_trigger_type NOT IN ('manual', 'scheduled', 'deployment') THEN
    RAISE EXCEPTION 'invalid_backup_trigger' USING ERRCODE = '22023';
  END IF;
  IF p_artifact_label IS NULL OR p_artifact_label !~ '^[A-Za-z0-9_.-]{1,160}$' THEN
    RAISE EXCEPTION 'invalid_backup_artifact_label' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.backup_runs (
    backup_kind,
    trigger_type,
    artifact_label,
    created_by_staff_id
  )
  VALUES (
    p_backup_kind,
    p_trigger_type,
    p_artifact_label,
    actor_staff_id
  )
  RETURNING id INTO run_id;

  RETURN run_id;
END
$$;

CREATE OR REPLACE FUNCTION public.complete_backup_run_v1(
  p_run_id UUID,
  p_database_table_count INTEGER,
  p_database_row_count BIGINT,
  p_storage_object_count BIGINT,
  p_storage_bytes BIGINT,
  p_checksum_sha256 TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  affected INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND (actor_staff_id IS NULL OR NOT public.is_admin()) THEN
    RAISE EXCEPTION 'admin_or_service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_database_table_count < 0
    OR p_database_row_count < 0
    OR p_storage_object_count < 0
    OR p_storage_bytes < 0 THEN
    RAISE EXCEPTION 'backup_counts_must_be_nonnegative' USING ERRCODE = '22023';
  END IF;
  IF p_checksum_sha256 IS NULL OR p_checksum_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_backup_checksum' USING ERRCODE = '22023';
  END IF;

  UPDATE public.backup_runs AS run
  SET status = 'completed',
      database_table_count = p_database_table_count,
      database_row_count = p_database_row_count,
      storage_object_count = p_storage_object_count,
      storage_bytes = p_storage_bytes,
      checksum_sha256 = p_checksum_sha256,
      completed_at = now()
  WHERE run.id = p_run_id
    AND run.status = 'started';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END
$$;

CREATE OR REPLACE FUNCTION public.fail_backup_run_v1(
  p_run_id UUID,
  p_error_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_staff_id UUID := public.current_staff_id();
  affected INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND (actor_staff_id IS NULL OR NOT public.is_admin()) THEN
    RAISE EXCEPTION 'admin_or_service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_error_code IS NULL OR p_error_code !~ '^[A-Za-z0-9_.:/-]{1,120}$' THEN
    RAISE EXCEPTION 'invalid_backup_error_code' USING ERRCODE = '22023';
  END IF;

  UPDATE public.backup_runs AS run
  SET status = 'failed',
      error_code = p_error_code,
      completed_at = now()
  WHERE run.id = p_run_id
    AND run.status = 'started';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END
$$;

CREATE OR REPLACE FUNCTION public.verify_backup_run_v1(
  p_run_id UUID,
  p_checksum_sha256 TEXT
)
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
  IF p_checksum_sha256 IS NULL OR p_checksum_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_backup_checksum' USING ERRCODE = '22023';
  END IF;

  UPDATE public.backup_runs AS run
  SET status = 'verified',
      verified_at = now(),
      verified_by_staff_id = actor_staff_id
  WHERE run.id = p_run_id
    AND run.status IN ('completed', 'verified')
    AND run.checksum_sha256 = p_checksum_sha256;

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 1 THEN
    UPDATE public.operational_events AS event
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by_staff_id = actor_staff_id
    WHERE event.status = 'open'
      AND event.event_key = 'backup.stale';
  END IF;
  RETURN affected = 1;
END
$$;

REVOKE ALL ON FUNCTION public.start_backup_run_v1(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_backup_run_v1(UUID, INTEGER, BIGINT, BIGINT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_backup_run_v1(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_backup_run_v1(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_backup_run_v1(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_backup_run_v1(UUID, INTEGER, BIGINT, BIGINT, BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_backup_run_v1(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_backup_run_v1(UUID, TEXT) TO authenticated;

COMMIT;
