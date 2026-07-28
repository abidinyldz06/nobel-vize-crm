-- Faz 4.3: uygulama seviyesinde sifreli, repo disi zamanlanmis continuity yedegi.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('continuity-backups', 'continuity-backups', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

-- Mevcut Storage politikalari yalniz `documents` bucket'ini kapsar. Yeni
-- bucket icin authenticated/anon politikasi eklenmez; service_role disindaki
-- istemciler continuity artefaktlarini okuyamaz.

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
  service_invocation BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  affected INTEGER;
BEGIN
  IF NOT service_invocation
    AND (actor_staff_id IS NULL OR NOT public.is_admin()) THEN
    RAISE EXCEPTION 'admin_or_service_role_required' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.verify_backup_run_v1(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_backup_run_v1(UUID, TEXT) TO authenticated, service_role;

COMMIT;
