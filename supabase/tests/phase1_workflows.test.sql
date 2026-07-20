BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(25);

SELECT has_table('public', 'country_visa_rules', 'canonical visa rules table exists');
SELECT has_function('public', 'create_customer_application_v1', ARRAY['jsonb'], 'atomic customer workflow exists');
SELECT has_function('public', 'update_application_status_v1', ARRAY['uuid', 'text', 'text', 'text'], 'atomic status workflow exists');
SELECT has_function('public', 'restore_backup_v2', ARRAY['jsonb'], 'atomic restore exists');
SELECT ok(to_regclass('public.uq_staff_user_id') IS NOT NULL, 'staff auth user uniqueness is enforced');
SELECT ok(to_regclass('public.uq_country_visa_rules_match') IS NOT NULL, 'visa rule match uniqueness is enforced');
SELECT ok(
  NOT has_function_privilege('anon', 'public.create_customer_application_v1(jsonb)', 'EXECUTE'),
  'anon cannot execute customer workflow'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.create_customer_application_v1(jsonb)', 'EXECUTE'),
  'authenticated staff can execute customer workflow'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.restore_backup_v2(jsonb)', 'EXECUTE'),
  'anon cannot execute restore'
);
SELECT ok(
  NOT has_function_privilege('service_role', 'public.restore_backup_v2(jsonb)', 'EXECUTE'),
  'service role cannot bypass the admin restore gate'
);

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'admin@example.com',
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Test Admin',
  'admin@example.com',
  'admin',
  true
);

INSERT INTO public.countries (id, name, base_fee_service, active)
VALUES ('30000000-0000-0000-0000-000000000001', 'Almanya', 2500, true);

INSERT INTO public.country_visa_rules (
  id,
  country_id,
  visa_category,
  documents
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'turistik',
  '[{"name":"Pasaport","category":"temel","required":true}]'::JSONB
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Ayşe",
        "last_name":"Yılmaz",
        "phone":"05550000000",
        "email":"ayse@example.com",
        "country_id":"30000000-0000-0000-0000-000000000001",
        "visa_type":"turistik",
        "matched_rule_id":"40000000-0000-0000-0000-000000000001",
        "assigned_staff_id":"10000000-0000-0000-0000-000000000001",
        "consulate_fee":1000
      }'::JSONB
    )
  $$,
  'customer, application, document and activity log are created atomically'
);

SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'one customer was created'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.applications WHERE country = 'Almanya' $$,
  $$ VALUES (1::BIGINT) $$,
  'one application was created'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.documents WHERE document_type = 'Pasaport' $$,
  $$ VALUES (1::BIGINT) $$,
  'canonical rule produced its document'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE performed_by_staff_id = '10000000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1::BIGINT) $$,
  'activity actor is stored as a staff foreign key'
);

SELECT throws_ok(
  $$
    SELECT public.create_customer_application_v1(
      '{
        "first_name":"Hatalı",
        "last_name":"Ücret",
        "phone":"05550000001",
        "country_id":"30000000-0000-0000-0000-000000000001",
        "visa_type":"turistik",
        "service_fee":-1
      }'::JSONB
    )
  $$,
  '22023',
  'fees_must_be_nonnegative',
  'invalid fee aborts the whole workflow'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE phone = '05550000001' $$,
  $$ VALUES (0::BIGINT) $$,
  'failed workflow leaves no partial customer'
);

SELECT lives_ok(
  $$
    SELECT public.update_application_status_v1(
      (SELECT id FROM public.applications WHERE country = 'Almanya' LIMIT 1),
      'evrak_bekleniyor',
      NULL,
      'Test durum değişikliği'
    )
  $$,
  'application status and log update atomically'
);
SELECT results_eq(
  $$ SELECT status FROM public.applications WHERE country = 'Almanya' LIMIT 1 $$,
  $$ VALUES ('evrak_bekleniyor'::TEXT) $$,
  'application status changed'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Test durum değişikliği' $$,
  $$ VALUES (1::BIGINT) $$,
  'status change created its activity log'
);

RESET ROLE;
CREATE TEMP TABLE phase1_backup_payload AS
SELECT jsonb_build_object(
  'format', 'nobel-vize-crm-backup',
  'version', '2.0',
  'exported_at', now(),
  'schema', 'phase1',
  'tables', jsonb_build_object(
    'tenants', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.tenants row),
    'staff', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.staff row),
    'countries', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.countries row),
    'country_visa_rules', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.country_visa_rules row),
    'customers', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.customers row),
    'applications', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.applications row),
    'documents', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.documents row),
    'notes', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.notes row),
    'payments', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.payments row),
    'activity_log', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.activity_log row),
    'communications', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.communications row),
    'visa_history', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.visa_history row),
    'family_members', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.family_members row),
    'webhook_events', (SELECT COALESCE(jsonb_agg(to_jsonb(row)), '[]'::JSONB) FROM public.webhook_events row)
  )
) AS payload;
GRANT SELECT ON phase1_backup_payload TO authenticated;

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.restore_backup_v2(payload) FROM phase1_backup_payload $$,
  'valid v2 backup restores in one transaction'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'restored customer remains available'
);
SELECT throws_ok(
  $$
    SELECT public.restore_backup_v2(payload #- '{tables,customers}')
    FROM phase1_backup_payload
  $$,
  '22023',
  'backup_table_missing_or_not_array:customers',
  'invalid backup is rejected before destructive work'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'failed restore leaves the existing customer intact'
);

RESET ROLE;
SELECT results_eq(
  $$ SELECT public FROM storage.buckets WHERE id = 'documents' $$,
  $$ VALUES (false) $$,
  'documents bucket remains private'
);

SELECT * FROM finish();
ROLLBACK;
