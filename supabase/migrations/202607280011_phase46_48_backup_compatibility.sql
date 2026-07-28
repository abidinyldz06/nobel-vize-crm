-- Faz 4.6-4.8: yeni kalici tablolarin kontrollu backup/restore uyumlulugu.

BEGIN;

ALTER FUNCTION public.restore_backup_v2(JSONB)
  RENAME TO restore_backup_v2_core_phase45;
REVOKE ALL ON FUNCTION public.restore_backup_v2_core_phase45(JSONB)
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
    'privacy_action_queue', 'privacy_action_approvals', 'privacy_audit_log',
    'leads', 'lead_events', 'appointment_events'
  ]
  LOOP
    IF (p_backup->'tables' ? table_name)
      AND jsonb_typeof(p_backup->'tables'->table_name) <> 'array' THEN
      RAISE EXCEPTION 'backup_table_not_array:%', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;

  PERFORM set_config('app.restore_mode', 'on', true);
  DELETE FROM public.appointment_events;
  DELETE FROM public.lead_events;
  DELETE FROM public.leads;
  DELETE FROM public.privacy_action_approvals;
  DELETE FROM public.privacy_audit_log;
  DELETE FROM public.privacy_action_queue;

  result := public.restore_backup_v2_core_phase45(p_backup);

  INSERT INTO public.leads (
    id, first_name, last_name, phone, email, passport_no, source, campaign,
    referral, status, target_country, visa_type, notes, assigned_staff_id,
    follow_up_due_at, last_contacted_at, converted_customer_id,
    converted_application_id, converted_at, created_by_staff_id, created_at,
    updated_at
  )
  SELECT
    row.id, row.first_name, row.last_name, row.phone, row.email, row.passport_no,
    row.source, row.campaign, row.referral, row.status, row.target_country,
    row.visa_type, row.notes, row.assigned_staff_id, row.follow_up_due_at,
    row.last_contacted_at, row.converted_customer_id, row.converted_application_id,
    row.converted_at, row.created_by_staff_id, row.created_at, row.updated_at
  FROM jsonb_populate_recordset(
    NULL::public.leads, COALESCE(p_backup->'tables'->'leads', '[]'::JSONB)
  ) AS row;
  INSERT INTO public.lead_events
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.lead_events, COALESCE(p_backup->'tables'->'lead_events', '[]'::JSONB)
  );
  INSERT INTO public.privacy_action_queue
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.privacy_action_queue,
    COALESCE(p_backup->'tables'->'privacy_action_queue', '[]'::JSONB)
  );
  INSERT INTO public.privacy_action_approvals
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.privacy_action_approvals,
    COALESCE(p_backup->'tables'->'privacy_action_approvals', '[]'::JSONB)
  );
  INSERT INTO public.privacy_audit_log
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.privacy_audit_log,
    COALESCE(p_backup->'tables'->'privacy_audit_log', '[]'::JSONB)
  );
  INSERT INTO public.appointment_events
  SELECT * FROM jsonb_populate_recordset(
    NULL::public.appointment_events,
    COALESCE(p_backup->'tables'->'appointment_events', '[]'::JSONB)
  );
  PERFORM set_config('app.restore_mode', 'off', true);
  RETURN result || jsonb_build_object('phase46_48_tables_restored', 6);
END
$$;

REVOKE ALL ON FUNCTION public.restore_backup_v2(JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.restore_backup_v2(JSONB) TO authenticated;

COMMIT;
