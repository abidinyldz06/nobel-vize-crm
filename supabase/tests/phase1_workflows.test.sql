BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(55);

SELECT has_table('public', 'country_visa_rules', 'canonical visa rules table exists');
SELECT has_function('public', 'create_customer_application_v1', ARRAY['jsonb'], 'atomic customer workflow exists');
SELECT has_function('public', 'update_application_status_v1', ARRAY['uuid', 'text', 'text', 'text'], 'atomic status workflow exists');
SELECT has_function('public', 'restore_backup_v2', ARRAY['jsonb'], 'atomic restore exists');
SELECT ok(to_regclass('public.uq_staff_user_id') IS NOT NULL, 'staff auth user uniqueness is enforced');
SELECT ok(to_regclass('public.uq_country_visa_rules_match') IS NOT NULL, 'visa rule match uniqueness is enforced');
SELECT ok(to_regclass('public.tenants_single_company_idx') IS NOT NULL, 'single company row uniqueness is enforced');
SELECT has_column('public', 'customers', 'is_deleted', 'customers have a soft-delete flag');
SELECT has_column('public', 'customers', 'deleted_at', 'customers record archive time');
SELECT has_function('public', 'archive_customers_v1', ARRAY['uuid[]'], 'atomic customer archive exists');
SELECT has_function('public', 'restore_customers_v1', ARRAY['uuid[]'], 'atomic customer restore exists');
SELECT has_function('public', 'list_archived_customers_v1', ARRAY[]::TEXT[], 'admin archive listing exists');
SELECT has_function('public', 'purge_deleted_customers_v1', ARRAY['uuid[]'], 'controlled permanent delete exists');
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.tenants $$,
  $$ VALUES (1::BIGINT) $$,
  'one company settings row is seeded'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'subdomain'),
  'retired subdomain setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'plan'),
  'retired SaaS plan setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'primary_color'),
  'retired white-label color setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_email'),
  'unused email notification setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_whatsapp'),
  'unused WhatsApp notification setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_reminder'),
  'unused reminder setting is removed'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'notify_status_change'),
  'unused status notification setting is removed'
);
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

SELECT results_eq(
  $$ SELECT public.current_staff_id() $$,
  $$ VALUES ('10000000-0000-0000-0000-000000000001'::UUID) $$,
  'authenticated auth user resolves to the linked active staff row'
);

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
  $$ SELECT public.archive_customers_v1(ARRAY[(SELECT id FROM public.customers WHERE email = 'ayse@example.com')]::UUID[]) $$,
  $$ VALUES (1) $$,
  'admin archives a customer atomically'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (0::BIGINT) $$,
  'archived customer is hidden by normal RLS reads'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.list_archived_customers_v1() WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'admin archive listing returns the archived customer'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Müşteri silindi: Ayşe Yılmaz — Test Admin' $$,
  $$ VALUES (1::BIGINT) $$,
  'customer archive writes the required named audit entry'
);
SELECT results_eq(
  $$ SELECT public.restore_customers_v1(ARRAY[(SELECT id FROM public.list_archived_customers_v1() WHERE email = 'ayse@example.com')]::UUID[]) $$,
  $$ VALUES (1) $$,
  'admin restores an archived customer'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers WHERE email = 'ayse@example.com' $$,
  $$ VALUES (1::BIGINT) $$,
  'restored customer returns to normal RLS reads'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE action = 'Müşteri geri yüklendi: Ayşe Yılmaz — Test Admin' $$,
  $$ VALUES (1::BIGINT) $$,
  'customer restore writes a named audit entry'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.customers $$,
  $$ VALUES (1::BIGINT) $$,
  'linked admin can read customers through RLS'
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
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE performed_by_staff_id = '10000000-0000-0000-0000-000000000001' AND action LIKE 'Yeni başvuru oluşturuldu:%' $$,
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
INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES (
  '20000000-0000-0000-0000-000000000002',
  'consultant@example.com',
  'authenticated',
  'authenticated',
  now()
);
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'Test Consultant',
  'consultant@example.com',
  'consultant',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.archive_customers_v1(ARRAY['10000000-0000-0000-0000-000000000099']::UUID[]) $$,
  '42501',
  'admin_required',
  'consultant cannot archive customers'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.customers (id, first_name, last_name, phone, email, assigned_staff_id)
VALUES (
  '50000000-0000-0000-0000-000000000002',
  'Kalıcı',
  'Silme',
  '05550000002',
  'purge@example.com',
  '10000000-0000-0000-0000-000000000001'
);
SELECT results_eq(
  $$ SELECT public.archive_customers_v1(ARRAY['50000000-0000-0000-0000-000000000002']::UUID[]) $$,
  $$ VALUES (1) $$,
  'purge candidate first moves to archive'
);
SELECT results_eq(
  $$ SELECT public.purge_deleted_customers_v1(ARRAY['50000000-0000-0000-0000-000000000002']::UUID[]) $$,
  $$ VALUES (0) $$,
  'customer cannot be permanently deleted before 30 days'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.list_archived_customers_v1() WHERE id = '50000000-0000-0000-0000-000000000002' $$,
  $$ VALUES (1::BIGINT) $$,
  'young archive record remains available'
);

RESET ROLE;
UPDATE public.customers
SET deleted_at = now() - interval '31 days'
WHERE id = '50000000-0000-0000-0000-000000000002';
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT results_eq(
  $$ SELECT public.purge_deleted_customers_v1(ARRAY['50000000-0000-0000-0000-000000000002']::UUID[]) $$,
  $$ VALUES (1) $$,
  'admin permanently deletes an archive record after 30 days'
);
SELECT results_eq(
  $$ SELECT count(*)::BIGINT FROM public.activity_log WHERE customer_id IS NULL AND action = 'Müşteri kalıcı silindi: Kalıcı Silme — Test Admin' $$,
  $$ VALUES (1::BIGINT) $$,
  'permanent delete leaves a non-cascading audit entry'
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
