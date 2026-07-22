-- Faz 3.5: mesaj şablonlarını backup v2 kapsamına ekler.
-- Eski v2 yedeklerinde message_templates bulunmayabilir; bu durumda mevcut
-- hazır şablon kataloğu korunur.

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
    'tenants', 'staff', 'countries', 'country_visa_rules', 'customers',
    'applications', 'documents', 'notes', 'payments', 'activity_log',
    'communications', 'visa_history', 'family_members', 'webhook_events'
  ];
  optional_tables CONSTANT TEXT[] := ARRAY[
    'tasks', 'notifications', 'tags', 'customer_tags', 'message_templates'
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

  FOREACH table_name IN ARRAY required_tables LOOP
    IF NOT (p_backup->'tables' ? table_name)
      OR jsonb_typeof(p_backup->'tables'->table_name) <> 'array' THEN
      RAISE EXCEPTION 'backup_table_missing_or_not_array:%', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY optional_tables LOOP
    IF (p_backup->'tables' ? table_name)
      AND jsonb_typeof(p_backup->'tables'->table_name) <> 'array' THEN
      RAISE EXCEPTION 'backup_table_not_array:%', table_name USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (p_backup->'tables' ? 'customer_tags') AND NOT (p_backup->'tables' ? 'tags') THEN
    RAISE EXCEPTION 'backup_tags_required_for_customer_tags' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.restore_mode', 'on', true);

  DELETE FROM public.notifications;
  DELETE FROM public.tasks;
  DELETE FROM public.customer_tags;
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
  IF p_backup->'tables' ? 'message_templates' THEN
    DELETE FROM public.message_templates;
  END IF;
  IF p_backup->'tables' ? 'tags' THEN
    DELETE FROM public.tags;
  END IF;
  DELETE FROM public.staff;
  DELETE FROM public.tenants;

  INSERT INTO public.tenants SELECT * FROM jsonb_populate_recordset(NULL::public.tenants, p_backup->'tables'->'tenants');
  INSERT INTO public.staff SELECT * FROM jsonb_populate_recordset(NULL::public.staff, p_backup->'tables'->'staff');
  IF p_backup->'tables' ? 'message_templates' THEN
    INSERT INTO public.message_templates
    SELECT * FROM jsonb_populate_recordset(NULL::public.message_templates, p_backup->'tables'->'message_templates');
  END IF;
  IF p_backup->'tables' ? 'tags' THEN
    INSERT INTO public.tags SELECT * FROM jsonb_populate_recordset(NULL::public.tags, p_backup->'tables'->'tags');
  END IF;
  INSERT INTO public.countries SELECT * FROM jsonb_populate_recordset(NULL::public.countries, p_backup->'tables'->'countries');
  INSERT INTO public.country_visa_rules SELECT * FROM jsonb_populate_recordset(NULL::public.country_visa_rules, p_backup->'tables'->'country_visa_rules');
  INSERT INTO public.customers SELECT * FROM jsonb_populate_recordset(NULL::public.customers, p_backup->'tables'->'customers');
  INSERT INTO public.applications SELECT * FROM jsonb_populate_recordset(NULL::public.applications, p_backup->'tables'->'applications');
  INSERT INTO public.documents SELECT * FROM jsonb_populate_recordset(NULL::public.documents, p_backup->'tables'->'documents');
  INSERT INTO public.notes SELECT * FROM jsonb_populate_recordset(NULL::public.notes, p_backup->'tables'->'notes');
  INSERT INTO public.payments SELECT * FROM jsonb_populate_recordset(NULL::public.payments, p_backup->'tables'->'payments');
  INSERT INTO public.activity_log SELECT * FROM jsonb_populate_recordset(NULL::public.activity_log, p_backup->'tables'->'activity_log');
  INSERT INTO public.communications SELECT * FROM jsonb_populate_recordset(NULL::public.communications, p_backup->'tables'->'communications');
  INSERT INTO public.tasks SELECT * FROM jsonb_populate_recordset(NULL::public.tasks, COALESCE(p_backup->'tables'->'tasks', '[]'::JSONB));
  INSERT INTO public.notifications SELECT * FROM jsonb_populate_recordset(NULL::public.notifications, COALESCE(p_backup->'tables'->'notifications', '[]'::JSONB));
  INSERT INTO public.visa_history SELECT * FROM jsonb_populate_recordset(NULL::public.visa_history, p_backup->'tables'->'visa_history');
  INSERT INTO public.family_members SELECT * FROM jsonb_populate_recordset(NULL::public.family_members, p_backup->'tables'->'family_members');
  INSERT INTO public.webhook_events SELECT * FROM jsonb_populate_recordset(NULL::public.webhook_events, p_backup->'tables'->'webhook_events');
  IF p_backup->'tables' ? 'customer_tags' THEN
    INSERT INTO public.customer_tags
    SELECT * FROM jsonb_populate_recordset(NULL::public.customer_tags, p_backup->'tables'->'customer_tags');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'version', '2.0',
    'restored_at', now(),
    'table_count', array_length(required_tables, 1)
      + 2
      + CASE WHEN p_backup->'tables' ? 'tags' THEN 1 ELSE 0 END
      + CASE WHEN p_backup->'tables' ? 'customer_tags' THEN 1 ELSE 0 END
      + CASE WHEN p_backup->'tables' ? 'message_templates' THEN 1 ELSE 0 END
  );
END
$$;

COMMIT;
