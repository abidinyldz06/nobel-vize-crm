-- Faz 4.2-4.5: yeni kalici tablolarin backup v2 restore uyumlulugu.

BEGIN;

ALTER FUNCTION public.restore_backup_v2(JSONB)
  RENAME TO restore_backup_v2_core_phase411;

REVOKE ALL ON FUNCTION public.restore_backup_v2_core_phase411(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restore_backup_v2(p_backup JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  table_name TEXT;
  result JSONB;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'scheduled_job_runs',
    'security_events',
    'communication_preferences',
    'message_outbox'
  ]
  LOOP
    IF (p_backup->'tables' ? table_name)
      AND jsonb_typeof(p_backup->'tables'->table_name) <> 'array' THEN
      RAISE EXCEPTION 'backup_table_not_array:%', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;

  DELETE FROM public.message_outbox;
  DELETE FROM public.communication_preferences;
  DELETE FROM public.security_events;
  DELETE FROM public.scheduled_job_runs;

  result := public.restore_backup_v2_core_phase411(p_backup);

  INSERT INTO public.scheduled_job_runs
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.scheduled_job_runs,
    COALESCE(p_backup->'tables'->'scheduled_job_runs', '[]'::JSONB)
  );
  INSERT INTO public.security_events
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.security_events,
    COALESCE(p_backup->'tables'->'security_events', '[]'::JSONB)
  );
  INSERT INTO public.communication_preferences
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.communication_preferences,
    COALESCE(p_backup->'tables'->'communication_preferences', '[]'::JSONB)
  );
  INSERT INTO public.message_outbox
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.message_outbox,
    COALESCE(p_backup->'tables'->'message_outbox', '[]'::JSONB)
  );

  RETURN result || jsonb_build_object('phase42_45_tables_restored', 4);
END
$$;

REVOKE ALL ON FUNCTION public.restore_backup_v2(JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.restore_backup_v2(JSONB) TO authenticated;

COMMIT;
