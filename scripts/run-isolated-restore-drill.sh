#!/bin/sh
set -eu

command -v jq >/dev/null 2>&1 || {
  echo "jq bulunamadı." >&2
  exit 1
}
command -v docker >/dev/null 2>&1 || {
  echo "Docker bulunamadı." >&2
  exit 1
}

status_json="$(npx supabase status -o json)"
db_url="$(printf '%s' "$status_json" | jq -r '.DB_URL // empty')"
case "$db_url" in
  postgresql://postgres:postgres@127.0.0.1:54322/postgres) ;;
  *)
    echo "Tatbikat yalnız 127.0.0.1:54322 yerel Supabase üzerinde çalışır." >&2
    exit 1
    ;;
esac

db_container="$(docker ps \
  --filter 'name=supabase_db_nobel-vize-crm' \
  --filter 'status=running' \
  --format '{{.Names}}' \
  | head -n 1)"
if [ "$db_container" != "supabase_db_nobel-vize-crm" ]; then
  echo "Yerel Supabase DB konteyneri çalışmıyor." >&2
  exit 1
fi

docker exec -i "$db_container" psql \
  --username postgres \
  --dbname postgres \
  --set ON_ERROR_STOP=1 <<'SQL'
BEGIN;

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '2f000000-0000-0000-0000-000000000001',
  'restore-drill-admin@example.test',
  'authenticated',
  'authenticated',
  now()
);
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '1f000000-0000-0000-0000-000000000001',
  '2f000000-0000-0000-0000-000000000001',
  'Restore Drill Admin',
  'restore-drill-admin@example.test',
  'admin',
  true
);

CREATE FUNCTION pg_temp.build_restore_payload()
RETURNS JSONB
LANGUAGE SQL
AS $$
  SELECT jsonb_build_object(
    'format', 'nobel-vize-crm-backup',
    'version', '2.0',
    'exported_at', now(),
    'schema', 'phase1',
    'storage', jsonb_build_object('included', false),
    'tables', jsonb_build_object(
      'tenants', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.tenants row),
      'staff', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.staff row),
      'privacy_settings', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.privacy_settings row),
      'privacy_notice_versions', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.privacy_notice_versions row),
      'message_templates', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.message_templates row),
      'tags', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.tags row),
      'countries', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.countries row),
      'country_visa_rules', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.country_visa_rules row),
      'customers', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.customers row),
      'customer_privacy_notices', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.customer_privacy_notices row),
      'customer_consents', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.customer_consents row),
      'data_subject_requests', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.data_subject_requests row),
      'customer_tags', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.customer_id, row.tag_id), '[]'::JSONB) FROM public.customer_tags row),
      'applications', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.applications row),
      'documents', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.documents row),
      'notes', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.notes row),
      'payments', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.payments row),
      'activity_log', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.activity_log row),
      'communications', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.communications row),
      'tasks', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.tasks row),
      'notifications', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.notifications row),
      'visa_history', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.visa_history row),
      'family_members', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.id), '[]'::JSONB) FROM public.family_members row),
      'webhook_events', (SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.event_id), '[]'::JSONB) FROM public.webhook_events row)
    )
  );
$$;

CREATE TEMP TABLE restore_drill_payload AS
SELECT pg_temp.build_restore_payload() AS payload;
CREATE TEMP TABLE restore_drill_storage AS
SELECT count(*)::BIGINT AS object_count
FROM storage.objects
WHERE bucket_id = 'documents';
GRANT SELECT ON restore_drill_payload, restore_drill_storage TO authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"2f000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT public.restore_backup_v2(payload) FROM restore_drill_payload;
RESET ROLE;

DO $$
DECLARE
  before_payload JSONB;
  after_payload JSONB;
  before_storage BIGINT;
  after_storage BIGINT;
  payload_checksum TEXT;
  row_count BIGINT;
BEGIN
  SELECT payload INTO before_payload FROM restore_drill_payload;
  after_payload := pg_temp.build_restore_payload();
  IF before_payload->'tables' IS DISTINCT FROM after_payload->'tables' THEN
    RAISE EXCEPTION 'restore_drill_table_data_mismatch';
  END IF;

  SELECT object_count INTO before_storage FROM restore_drill_storage;
  SELECT count(*)::BIGINT INTO after_storage
  FROM storage.objects
  WHERE bucket_id = 'documents';
  IF before_storage <> after_storage THEN
    RAISE EXCEPTION 'restore_drill_storage_inventory_mismatch';
  END IF;
  IF (SELECT public FROM storage.buckets WHERE id = 'documents') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'restore_drill_documents_bucket_not_private';
  END IF;

  SELECT encode(extensions.digest(before_payload::TEXT, 'sha256'), 'hex')
  INTO payload_checksum;
  SELECT sum(jsonb_array_length(value))::BIGINT
  INTO row_count
  FROM jsonb_each(before_payload->'tables');

  RAISE NOTICE 'RESTORE_DRILL_OK checksum=% rows=% storage_objects=%',
    payload_checksum,
    row_count,
    after_storage;
END
$$;

ROLLBACK;
SQL
