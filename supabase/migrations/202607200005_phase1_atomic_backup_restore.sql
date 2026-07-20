-- Faz 1: backup v2 formatini tek PostgreSQL transaction'i icinde geri yukler.
-- Fonksiyon herhangi bir hata halinde tum silme/ekleme islemlerini rollback eder.

BEGIN;

CREATE OR REPLACE FUNCTION public.restore_backup_v2(p_backup JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  table_name TEXT;
  required_tables CONSTANT TEXT[] := ARRAY[
    'tenants',
    'staff',
    'countries',
    'country_visa_rules',
    'customers',
    'applications',
    'documents',
    'notes',
    'payments',
    'activity_log',
    'communications',
    'visa_history',
    'family_members',
    'webhook_events'
  ];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_backup IS NULL OR jsonb_typeof(p_backup) <> 'object' THEN
    RAISE EXCEPTION 'backup_object_required' USING ERRCODE = '22023';
  END IF;
  IF p_backup->>'format' <> 'nobel-vize-crm-backup' OR p_backup->>'version' <> '2.0' THEN
    RAISE EXCEPTION 'unsupported_backup_format_or_version' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_backup->'tables') <> 'object' THEN
    RAISE EXCEPTION 'backup_tables_object_required' USING ERRCODE = '22023';
  END IF;

  FOREACH table_name IN ARRAY required_tables
  LOOP
    IF NOT (p_backup->'tables' ? table_name)
      OR jsonb_typeof(p_backup->'tables'->table_name) <> 'array' THEN
      RAISE EXCEPTION 'backup_table_missing_or_not_array:%', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Restore sirasinda activity actor trigger'i yedekteki Sistem kayitlarini
  -- aktif admin kullaniciya cevirmemelidir.
  PERFORM set_config('app.restore_mode', 'on', true);

  DELETE FROM public.webhook_events;
  DELETE FROM public.activity_log;
  DELETE FROM public.family_members;
  DELETE FROM public.visa_history;
  DELETE FROM public.communications;
  DELETE FROM public.notes;
  DELETE FROM public.payments;
  DELETE FROM public.documents;
  DELETE FROM public.applications;
  DELETE FROM public.customers;
  DELETE FROM public.country_visa_rules;
  DELETE FROM public.countries;
  DELETE FROM public.staff;
  DELETE FROM public.tenants;

  INSERT INTO public.tenants
  SELECT * FROM jsonb_populate_recordset(NULL::public.tenants, p_backup->'tables'->'tenants');

  INSERT INTO public.staff
  SELECT * FROM jsonb_populate_recordset(NULL::public.staff, p_backup->'tables'->'staff');

  INSERT INTO public.countries
  SELECT * FROM jsonb_populate_recordset(NULL::public.countries, p_backup->'tables'->'countries');

  INSERT INTO public.country_visa_rules
  SELECT * FROM jsonb_populate_recordset(NULL::public.country_visa_rules, p_backup->'tables'->'country_visa_rules');

  INSERT INTO public.customers
  SELECT * FROM jsonb_populate_recordset(NULL::public.customers, p_backup->'tables'->'customers');

  INSERT INTO public.applications
  SELECT * FROM jsonb_populate_recordset(NULL::public.applications, p_backup->'tables'->'applications');

  INSERT INTO public.documents
  SELECT * FROM jsonb_populate_recordset(NULL::public.documents, p_backup->'tables'->'documents');

  INSERT INTO public.notes
  SELECT * FROM jsonb_populate_recordset(NULL::public.notes, p_backup->'tables'->'notes');

  INSERT INTO public.payments
  SELECT * FROM jsonb_populate_recordset(NULL::public.payments, p_backup->'tables'->'payments');

  INSERT INTO public.activity_log
  SELECT * FROM jsonb_populate_recordset(NULL::public.activity_log, p_backup->'tables'->'activity_log');

  INSERT INTO public.communications
  SELECT * FROM jsonb_populate_recordset(NULL::public.communications, p_backup->'tables'->'communications');

  INSERT INTO public.visa_history
  SELECT * FROM jsonb_populate_recordset(NULL::public.visa_history, p_backup->'tables'->'visa_history');

  INSERT INTO public.family_members
  SELECT * FROM jsonb_populate_recordset(NULL::public.family_members, p_backup->'tables'->'family_members');

  INSERT INTO public.webhook_events
  SELECT * FROM jsonb_populate_recordset(NULL::public.webhook_events, p_backup->'tables'->'webhook_events');

  RETURN jsonb_build_object(
    'success', true,
    'version', '2.0',
    'restored_at', now(),
    'table_count', array_length(required_tables, 1)
  );
END
$$;

REVOKE ALL ON FUNCTION public.restore_backup_v2(JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.restore_backup_v2(JSONB) TO authenticated;

COMMIT;
