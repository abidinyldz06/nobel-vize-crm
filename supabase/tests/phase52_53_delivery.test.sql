BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(19);

SELECT has_table('public', 'staff_capacity', 'staff capacity limits exist');
SELECT has_table('public', 'calendar_connections', 'encrypted calendar connections exist');
SELECT has_table('public', 'calendar_event_links', 'calendar event links exist');
SELECT has_column('public', 'payments', 'due_at', 'payments retain an explicit due date');
SELECT has_function('public', 'record_portal_document_upload_v1', ARRAY['uuid', 'uuid', 'text', 'text', 'text', 'bigint'], 'portal upload commit is service controlled');
SELECT has_function('public', 'set_staff_capacity_v1', ARRAY['uuid', 'integer', 'integer'], 'admin capacity workflow exists');
SELECT has_function('public', 'get_google_calendar_connection_status_v1', ARRAY[]::TEXT[], 'safe calendar status workflow exists');
SELECT ok(NOT has_table_privilege('authenticated', 'public.calendar_connections', 'SELECT'), 'staff cannot read encrypted Google tokens');
SELECT ok(NOT has_function_privilege('authenticated', 'public.record_portal_document_upload_v1(uuid,uuid,text,text,text,bigint)', 'EXECUTE'), 'portal commit cannot be forged by a browser session');
SELECT ok(has_function_privilege('service_role', 'public.record_portal_document_upload_v1(uuid,uuid,text,text,text,bigint)', 'EXECUTE'), 'portal commit is available only to the service role');

INSERT INTO auth.users (id, email, role, aud, email_confirmed_at)
VALUES ('52530000-0000-0000-0000-000000000001', 'phase53-admin@example.test', 'authenticated', 'authenticated', now());
INSERT INTO public.staff (id, user_id, full_name, email, role, is_active)
VALUES ('52530000-0000-0000-0000-000000000002', '52530000-0000-0000-0000-000000000001', 'Faz 5.3 Yönetici', 'phase53-admin@example.test', 'admin', true);
INSERT INTO public.customers (id, first_name, last_name, phone, assigned_staff_id, is_deleted)
VALUES ('52530000-0000-0000-0000-000000000003', 'Kapasite', 'Müşterisi', '05552530000', '52530000-0000-0000-0000-000000000002', false);
INSERT INTO public.applications (id, customer_id, country, visa_type, status, assigned_staff_id)
VALUES
  ('52530000-0000-0000-0000-000000000004', '52530000-0000-0000-0000-000000000003', 'Fransa', 'turistik', 'evrak_bekleniyor', '52530000-0000-0000-0000-000000000002'),
  ('52530000-0000-0000-0000-000000000005', '52530000-0000-0000-0000-000000000003', 'Almanya', 'turistik', 'profil_analizi', '52530000-0000-0000-0000-000000000002');
INSERT INTO public.payments (id, application_id, amount, status, currency, due_at)
VALUES ('52530000-0000-0000-0000-000000000006', '52530000-0000-0000-0000-000000000004', 1200, 'bekliyor', 'TRY', now() - interval '1 day');

SELECT set_config('request.jwt.claims', '{"sub":"52530000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.set_staff_capacity_v1('52530000-0000-0000-0000-000000000002', 1, 40) $$,
  'admin sets a bounded capacity limit'
);
SELECT is(
  (SELECT max_active_applications FROM public.staff_capacity WHERE staff_id = '52530000-0000-0000-0000-000000000002'),
  1,
  'active application capacity is persisted'
);
SELECT is(
  (SELECT max_open_tasks FROM public.staff_capacity WHERE staff_id = '52530000-0000-0000-0000-000000000002'),
  40,
  'open task capacity is persisted'
);
SELECT is(
  (SELECT connected FROM public.get_google_calendar_connection_status_v1()),
  false,
  'staff sees only a safe disconnected calendar status'
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO public.calendar_connections (
       staff_id, provider, calendar_id, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at
     ) VALUES (
       '52530000-0000-0000-0000-000000000002', 'google', 'primary', repeat('A', 64), repeat('B', 64), now() + interval '1 hour'
     ) $$,
  'only the service role can store encrypted calendar connection records'
);
SELECT lives_ok(
  $$ SELECT public.run_scheduled_operations_v1('2026-08-02T10:00:00Z') $$,
  'operations cron processes due payments and capacity alerts'
);
RESET ROLE;

SELECT is(
  (SELECT due_at FROM public.tasks WHERE idempotency_key = 'payment:52530000-0000-0000-0000-000000000006:pending'),
  (SELECT due_at FROM public.payments WHERE id = '52530000-0000-0000-0000-000000000006'),
  'payment task uses the explicit payment due date'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.notifications WHERE idempotency_key LIKE 'capacity:applications:52530000-0000-0000-0000-000000000002:%'),
  1::BIGINT,
  'excess active applications create one deduplicated capacity alert'
);
SELECT is(
  (SELECT count(*)::BIGINT FROM public.tasks WHERE idempotency_key = 'payment:52530000-0000-0000-0000-000000000006:pending'),
  1::BIGINT,
  'due payment task remains idempotent within the same work window'
);

SELECT * FROM finish();
ROLLBACK;
